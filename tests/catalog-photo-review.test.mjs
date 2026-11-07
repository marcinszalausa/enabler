import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createRequire} from "node:module";
import ts from "typescript";
import sharp from "sharp";
const require=createRequire(import.meta.url);
async function compile(path,dependencies={}){
 const source=await readFile(path,"utf8"),module={exports:{}};
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 new Function("require","module","exports",js)(id=>id in dependencies?dependencies[id]:id==="server-only"?{}:require(id),module,module.exports);
 return module.exports;
}
const photos=await compile("src/lib/catalog/photo-check.ts",{"../public-fetch":{fetchPublicUrl:()=>{throw Error("No real network in tests");}}});
const access=await compile("src/lib/catalog/photo-access.ts");
const item={id:"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",workspace_id:"workspace",connection_id:"connection",image_revision:"revision",images:[]};
function client({user=true,visible=true,plan=true,owner=true,enabled=true,fail=false}={}){
 return {auth:{getUser:async()=>({data:{user:user?{id:"owner"}:null},error:null})},rpc:async(name)=>({data:name==="can_connect_store"?plan:owner,error:fail?{}:null}),from(table){const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:table==="catalog_items"?(visible?item:null):(enabled?{id:"connection"}:null),error:null})};return q;}};
}
test("photo access fails closed for unauthenticated, foreign, lower-tier, non-owner and disconnected requests",async()=>{
 for(const option of [{user:false},{visible:false},{plan:false},{owner:false},{enabled:false}])assert.equal(await access.photoReviewItem(client(option),item.id),null);
 assert.equal(await access.photoReviewItem(client(),"not-a-uuid"),null);
 assert.equal(await access.photoReviewItem(client(),item.id),item);
 await assert.rejects(access.photoReviewItem(client({fail:true}),item.id),/ACCESS_FAILED/);
});
test("expensive checks have concurrency and workspace cooldown limits",()=>{
 const budget=new access.PhotoCheckBudget();assert.equal(budget.take("a",0),true);assert.equal(budget.take("a",1),false);assert.equal(budget.take("b",1),true);assert.equal(budget.take("c",1),false);budget.release();assert.equal(budget.take("c",1),true);budget.release();budget.release();assert.equal(budget.take("a",60001),true);
});
async function picture(seed){
 const pixels=Buffer.alloc(8*8);let state=seed;for(let i=0;i<pixels.length;i++){state=(Math.imul(state,1664525)+1013904223)>>>0;pixels[i]=state>>>24;}
 return sharp(pixels,{raw:{width:8,height:8,channels:1}}).resize(1024,1024,{kernel:"nearest"}).jpeg({quality:95}).toBuffer();
}
const fixtures=await Promise.all(Array.from({length:21},(_,i)=>picture(123+i*719)));
const response=body=>({status:200,contentType:"image/jpeg",body,url:new URL("https://store.example/photo.jpg")});
test("technical readiness requires ten distinct high-resolution photos and produces stripped normalized bytes",async()=>{
 const images=fixtures.slice(0,10).map((_,i)=>"https://store.example/"+i);
 const {accepted,report}=await photos.scanCatalogPhotos(images,async url=>response(fixtures[Number(url.split("/").pop())]));
 assert.equal(report.ready,true);assert.equal(report.usable,10);assert.equal(report.complete,true);assert.equal(accepted.length,10);
 assert.equal((await sharp(accepted[0].bytes).metadata()).exif,undefined);
 const nine=await photos.scanCatalogPhotos(images.slice(0,9),async url=>response(fixtures[Number(url.split("/").pop())]));assert.equal(nine.report.ready,false);
});
test("small, duplicate and broken source images are explained rather than counted",async()=>{
 const small=await sharp({create:{width:300,height:400,channels:3,background:"white"}}).jpeg().toBuffer();
 const inputs=["https://store.example/a","https://store.example/b","https://store.example/small","https://store.example/broken","https://store.example/a"];
 const {report}=await photos.scanCatalogPhotos(inputs,async url=>{if(url.endsWith("broken"))throw Error("unavailable");return response(url.endsWith("small")?small:fixtures[0]);});
 assert.deepEqual(report.photos.map(p=>p.status),["usable","duplicate","small","unreadable","duplicate"]);assert.equal(report.usable,1);assert.equal(report.ready,false);
});
test("a vector disguised as a photograph is rejected",async()=>{
 const body=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="red"/></svg>');
 const {report}=await photos.scanCatalogPhotos(["https://store.example/disguised.jpg"],async()=>response(body));assert.equal(report.usable,0);assert.equal(report.photos[0].status,"unreadable");
});
test("aggregate bytes and usable image count are bounded",async()=>{
 let downloads=0;const input=Array.from({length:30},(_,i)=>"https://store.example/"+i);
 const limited=await photos.scanCatalogPhotos(input,async()=>{downloads++;return {...response(Buffer.alloc(6*1024*1024)),contentType:"text/html"};});assert.equal(downloads,6);assert.equal(limited.report.complete,false);assert.equal(limited.report.photos[6].status,"not_checked");
 const twenty=await photos.scanCatalogPhotos(input,async url=>response(fixtures[Number(url.split("/").pop())]));assert.equal(twenty.report.usable,20);assert.equal(twenty.report.photos[20].status,"not_checked");
});
test("check endpoint refuses unauthorized work, drops stale reports and returns no image bytes",async()=>{
 let permitted=true,stale=false,scans=0,reads=0,workspace=1;
 const route=await compile("src/app/api/catalog/photos/check/route.ts",{
  "@/lib/supabase/server":{createClient:async()=>({})},
  "@/lib/catalog/security":{catalogBody:async request=>Buffer.from(await request.text())},
  "@/lib/catalog/photo-access":{...access,photoReviewItem:async()=>{reads++;return permitted?{...item,workspace_id:"workspace"+workspace,image_revision:stale&&reads%2===0?"changed":"revision"}:null;}},
  "@/lib/catalog/photo-check":{scanCatalogPhotos:async()=>{scans++;return {report:{usable:10,minimum:10,ready:true,photos:[],complete:true},accepted:[{bytes:Buffer.from("private bytes")}]};}},
 });
 const request=(origin="https://gooidy.com")=>new Request("https://gooidy.com/api/catalog/photos/check",{method:"POST",headers:{origin,"Content-Type":"application/json"},body:JSON.stringify({itemId:item.id,images:["https://malicious.example/ignored"]})});
 assert.equal((await route.POST(request("https://foreign.example"))).status,403);assert.equal(reads,0);
 permitted=false;assert.equal((await route.POST(request())).status,403);assert.equal(scans,0);
 permitted=true;reads=0;stale=true;assert.equal((await route.POST(request())).status,409);
 stale=false;reads=0;workspace++;const result=await route.POST(request());assert.equal(result.status,200);const body=await result.json();assert.equal(body.report.ready,true);assert.equal(body.accepted,undefined);assert.equal(JSON.stringify(body).includes("private bytes"),false);
});
