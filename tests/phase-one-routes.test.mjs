import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';import ts from 'typescript';
const require=createRequire(import.meta.url),itemId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
async function trainingRoute({permitted=true,configured=true,spendingEnabled=false,rpcResult=false}={}){
 let reads=0,rpcs=0,events=0,afterCalls=0;const calls=[];
 const dependencies={
  'next/server':{after(){afterCalls++;}},'@/lib/supabase/server':{createClient:async()=>{reads++;return {auth:{getUser:async()=>({data:{user:{id:'verified-owner'}}})}};}},
  '@/lib/supabase/admin':{createAdminClient:()=>({rpc:async(name,args)=>{rpcs++;calls.push({name,args});return {data:rpcResult,error:null};}})},
  '@/lib/catalog/photo-access':{validCatalogId:v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v),photoReviewItem:async()=>permitted?{id:itemId,workspace_id:'owned-workspace',product_url:'https://store.example/p',image_revision:'revision'}:null},
  '@/lib/catalog/training-photos':{trainingPhotos:async()=>Array.from({length:10},(_,i)=>({key:'store:'+i,url:'https://store.example/'+i+'.jpg'}))},
  '@/lib/catalog/training-policy':{trainingSetup:()=>({configured,spendingEnabled}),selectedPhotoKeys:v=>v},
  '@/lib/catalog/security':{catalogBody:async r=>Buffer.from(await r.text()),trainingAllowed:()=>true},'@/inngest/client':{inngest:{send:async()=>{events++;}}}
 };
 const source=await readFile('src/app/api/catalog/training/route.ts','utf8'),module={exports:{}};const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports','module',js)(id=>id in dependencies?dependencies[id]:require(id),module.exports,module);
 const request=(body={},origin='https://gooidy.com')=>new Request('https://gooidy.com/api/catalog/training',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({itemId,...body})});
 return {route:module.exports,request,state:()=>({reads,rpcs,events,afterCalls,calls})};
}
test('cross-origin and unauthorized requests never reserve training or enqueue work',async()=>{
 const r=await trainingRoute({permitted:false});assert.equal((await r.route.POST(r.request({action:'start'},'https://foreign.example'))).status,403);assert.equal(r.state().reads,0);
 assert.equal((await r.route.POST(r.request({action:'prepare'}))).status,403);assert.equal(r.state().rpcs,0);assert.equal(r.state().afterCalls,0);
});
test('provider spending stays disabled even for an authenticated owner',async()=>{
 const r=await trainingRoute({spendingEnabled:false});const response=await r.route.POST(r.request({action:'start',jobId:itemId,budgetConfirmed:true}));assert.equal(response.status,503);assert.equal(r.state().rpcs,0);assert.equal(r.state().events,0);
});
test('photo preparation requires current source and explicit source consent',async()=>{
 const r=await trainingRoute();assert.equal((await r.route.POST(r.request({action:'prepare'}))).status,400);
 assert.equal((await r.route.POST(r.request({action:'prepare',rightsConfirmed:true,productConfirmed:true,sourceRevision:'stale'}))).status,409);assert.equal(r.state().rpcs,0);
});
test('preparation binds the verified owner and workspace, ignoring browser identity fields',async()=>{
 const r=await trainingRoute({rpcResult:'prepared-job'});const response=await r.route.POST(r.request({action:'prepare',sourceRevision:'revision',photos:Array.from({length:10},(_,i)=>'store:'+i),rightsConfirmed:true,productConfirmed:true,workspaceId:'foreign',actor:'attacker'}));
 assert.equal(response.status,202);assert.equal(r.state().calls[0].args.ws,'owned-workspace');assert.equal(r.state().calls[0].args.actor,'verified-owner');assert.equal(r.state().afterCalls,1);
});
test('starting a foreign or unfunded job is refused by the bound database operation',async()=>{
 const r=await trainingRoute({spendingEnabled:true,rpcResult:false});assert.equal((await r.route.POST(r.request({action:'start',jobId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',budgetConfirmed:true}))).status,409);assert.equal(r.state().calls[0].args.item,itemId);assert.equal(r.state().calls[0].args.actor,'verified-owner');assert.equal(r.state().afterCalls,0);
});
