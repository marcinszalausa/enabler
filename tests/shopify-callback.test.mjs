import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function load(file,mocks){
 const js=ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,module={exports:{}};
 vm.runInNewContext(js,{exports:module.exports,module,require:id=>{if(id in mocks)return mocks[id];throw new Error("Unmocked "+id);},process,Date,console,URL,URLSearchParams,Response,AbortSignal},{filename:file});return module.exports;
}
function fixture({owner=true,cookie=true}={}){
 let stateAvailable=true,tokenCalls=0,saved=0;
 const nonce="a".repeat(64),pending={workspace_id:"workspace"};
 const chain={select(){return this;},eq(){return this;},gt(){return this;},delete(){this.deleting=true;return this;},async single(){return {data:stateAvailable?pending:null};},async maybeSingle(){if(!stateAvailable)return {data:null};stateAvailable=false;return {data:{state_hash:"hash"}};}};
 const db={from(){return chain;},async rpc(name,values){assert.equal(name,"install_shopify_store");assert.equal(values.ws,"workspace");assert.equal(values.domain,"store.myshopify.com");assert.equal(values.credentials,"encrypted");saved++;return {data:{id:"store",installation_id:"installation"}};}};
 const handler=load("src/app/api/shopify/callback/route.ts",{
 "next/headers":{cookies:async()=>({get:()=>({value:cookie?nonce:"wrong"}),delete(){}})},"next/server":{after(){}},
 "@/lib/supabase/server":{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:"user"}}})}})},
 "@/lib/supabase/admin":{createAdminClient:()=>db},
 "@/lib/catalog/auth":{catalogOwner:async ws=>{assert.equal(ws,"workspace");if(!owner)throw new Error("OWNER");}},
 "@/lib/catalog/security":{encryptCatalogSecret:()=>"encrypted"},
 "@/lib/shopify/security":{callbackValid:()=>true,shopDomain:v=>v,stateHash:()=>"hash",shopifyConfigured:()=>true,SHOPIFY_COOKIE:"state"},
 "@/lib/shopify/api":{tokenRequest:async()=>{tokenCalls++;return {expires_in:3600,refresh_token_expires_in:7776000,access_token:"token"};},graph:async()=>({shop:{id:"gid://shopify/Shop/1",name:"Store",myshopifyDomain:"store.myshopify.com",primaryDomain:{url:"https://store.example"}}})},
 "@/inngest/client":{inngest:{}}
 });
 return {handler,request:()=>new Request("https://gooidy.com/api/shopify/callback?state="+nonce+"&shop=store.myshopify.com&code=code"),counts:()=>({tokenCalls,saved})};
}
test("callback consumes state once and stores credentials only on server",async()=>{
 const f=fixture();assert.match((await f.handler.GET(f.request())).headers.get("location"),/notice=connected$/);
 assert.match((await f.handler.GET(f.request())).headers.get("location"),/notice=connect_error$/);
 assert.deepEqual(f.counts(),{tokenCalls:1,saved:1});
});
test("wrong browser or revoked owner cannot exchange tokens",async()=>{
 for(const settings of [{cookie:false},{owner:false}]){
  const f=fixture(settings);assert.match((await f.handler.GET(f.request())).headers.get("location"),/notice=connect_error$/);assert.deepEqual(f.counts(),{tokenCalls:0,saved:0});
 }
});

test("disconnect stops syncing even when Shopify access has expired",async()=>{
 process.env.VERCEL_ENV="production";
 let stopped=0;
 const handler=load("src/app/api/shopify/manage/route.ts",{
 "next/server":{after(){}},
 "@/lib/supabase/admin":{createAdminClient:()=>({from(){return {select(){return this;},eq(){return this;},async single(){return {data:{id:"store",shop:"store.myshopify.com",installation_id:"install",status:"connected"}};}};},async rpc(name){assert.equal(name,"disconnect_shopify_store");stopped++;return {data:true};}})},
 "@/lib/catalog/security":{catalogBody:async()=>Buffer.from("workspaceId=workspace&storeId=store&action=disconnect")},
 "@/lib/catalog/auth":{catalogOwner:async()=>{},catalogSameOrigin(){}},
 "@/lib/shopify/security":{shopifyConfigured:()=>true},
 "@/lib/shopify/api":{storeToken:async()=>{throw new Error("expired");},graph(){throw new Error("must not call without token");}},
 "@/inngest/client":{inngest:{}}
 });
 const result=await handler.POST(new Request("https://gooidy.com/api/shopify/manage",{method:"POST",body:"fixture"}));
 assert.equal(stopped,1);assert.match(result.headers.get("location"),/notice=disconnected_local$/);
});
