import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import ts from "typescript";
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
