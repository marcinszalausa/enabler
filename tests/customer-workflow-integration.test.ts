import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import ts from "typescript";
import {createHash} from "node:crypto";
import {copyEdits,parseMetrics} from "../src/lib/customer-workflow.ts";
function compile(source:string,dependencies:Record<string,unknown>,result:string){
 const clean=source.replace(/^import[\s\S]*?;\r?$/gm,"").replace(/\bexport /g,"");
 const js=ts.transpileModule(clean,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 return new Function(...Object.keys(dependencies),js+";return "+result)(...Object.values(dependencies));
}
test("actual revision action blocks viewers, hidden rows and stale edits; video edits preserve rendered copy",async()=>{
 let editor=false,visible=true,updates=0;
 let creative:any={id:"ad",workspace_id:"workspace",kind:"video",headline:"Baked headline",primary_text:"Original caption",cta:"Shop now",generations:{product_id:"product",status:"succeeded",showcased_at:null}};
 const db={auth:{getUser:async()=>({data:{user:{id:"owner"}}})},from:(table:string)=>{
  assert.equal(table,"creatives");const filters:Record<string,unknown>={};let edits:any;
  const q:any={select:()=>q,eq:(key:string,value:unknown)=>{filters[key]=value;return q;},is:(key:string,value:unknown)=>{filters[key]=value;return q;},update:(value:unknown)=>{edits=value;return q;},maybeSingle:async()=>{
   if(!visible||Object.entries(filters).some(([k,v])=>creative[k]!==v))return {data:null};
   if(edits){updates++;creative={...creative,...edits};return {data:{id:creative.id}};}return {data:creative};
  }};return q;
 }};
 const {saveAdCopy}=compile(await readFile("src/app/[locale]/dashboard/products/[id]/revision-actions.ts","utf8"),{revalidatePath:()=>{},createClient:async()=>db,canEditWorkspace:async()=>editor,WORKSPACE_WRITE_DENIED:"editor required",copyEdits},"{saveAdCopy}");
 const form=new FormData();form.set("creativeId","ad");form.set("primary_text","Revised caption");form.set("headline","Must not alter video");form.set("cta","Must not alter video");form.set("version",JSON.stringify([creative.headline,creative.primary_text,creative.cta]));
 assert.equal((await saveAdCopy({},form)).error,"editor required");assert.equal(updates,0);
 editor=true;visible=false;assert.equal((await saveAdCopy({},form)).saved,false);assert.equal(updates,0);
 visible=true;form.set("version","stale");assert.equal((await saveAdCopy({},form)).saved,false);assert.equal(updates,0);
 form.set("version",JSON.stringify([creative.headline,creative.primary_text,creative.cta]));assert.equal((await saveAdCopy({},form)).saved,true);
 assert.equal(updates,1);assert.equal(creative.primary_text,"Revised caption");assert.equal(creative.headline,"Baked headline");assert.equal(creative.cta,"Shop now");
 creative.generations.showcased_at="2026-01-01";assert.equal((await saveAdCopy({},form)).saved,false);assert.equal(updates,1);
});
test("actual analytics client handles pending, denied and mismatched results without inventing metrics",async()=>{
 const previous=process.env.ZERNIO_API_KEY;process.env.ZERNIO_API_KEY="fixture-not-a-secret";
 let status=202,body:any={},calls=0;
 try{
 const {getPostAnalytics}=compile(await readFile("src/lib/social/analytics.ts","utf8"),{parseMetrics,fetch:async(url:URL,options:any)=>{calls++;assert.equal(url.searchParams.get("postId"),"owned-post");assert.equal(options.cache,"no-store");return new Response(JSON.stringify(body),{status});}},"{getPostAnalytics}");
 assert.equal((await getPostAnalytics("owned-post")).state,"pending");
 status=402;assert.equal((await getPostAnalytics("owned-post")).state,"addon");
 status=200;body={postId:"other",syncStatus:"synced",analytics:{impressions:1000,clicks:20}};assert.equal((await getPostAnalytics("owned-post")).metrics,null);
 body.postId="owned-post";const ready=await getPostAnalytics("owned-post");assert.equal(ready.state,"ready");assert.equal(ready.metrics.clicks,20);assert.equal(ready.metrics.views,null);
 body.syncStatus="partial";assert.equal((await getPostAnalytics("owned-post")).metrics,null);
 assert.equal(calls,5);
 }finally{if(previous===undefined)delete process.env.ZERNIO_API_KEY;else process.env.ZERNIO_API_KEY=previous;}
});
test("private image revalidation skips rendering unchanged ads and never bypasses ownership",async()=>{
 let visible=true,renders=0;
 let creative:any={workspace_id:"workspace",storage_path:"workspace/photo.jpg",aspect:"1:1",headline:"Original headline",cta:"Shop now"};
 const db={from:()=>{const q:any={select:()=>q,eq:()=>q,not:()=>q,maybeSingle:async()=>({data:visible?creative:null})};return q;}};
 const {GET}=compile(await readFile("src/app/api/creatives/[id]/image/route.ts","utf8"),{createHash,createClient:async()=>db,createAdminClient:()=>db,getBrandKit:async()=>({accent_color:"#ffffff",font:"inter",logo_path:null}),FACE_SAFE_LAYOUT_VERSION:"fixture",renderAdImage:async()=>{renders++;return new Response("image",{headers:{"content-type":"image/png"}});},wantsImagePreview:()=>true,makeImagePreview:async(image:Response)=>image},"{GET}");
 const request=(etag?:string)=>({headers:new Headers(etag?{"if-none-match":etag}:{}),nextUrl:new URL("https://example.invalid/api/creatives/ad/image?preview=1")});
 const context={params:Promise.resolve({id:"ad"})};
 const first=await GET(request(),context);assert.equal(first.status,200);const tag=first.headers.get("etag");assert.ok(tag);assert.equal(renders,1);
 assert.equal((await GET(request(tag),context)).status,304);assert.equal(renders,1,"Unchanged photos do not rerender");
 creative={...creative,headline:"Revised headline"};const changed=await GET(request(tag),context);assert.equal(changed.status,200);assert.notEqual(changed.headers.get("etag"),tag);assert.equal(renders,2);
 visible=false;assert.equal((await GET(request(changed.headers.get("etag")),context)).status,404);assert.equal(renders,2,"Cached validators cannot bypass access checks");
});
