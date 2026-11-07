import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';import ts from 'typescript';
const require=createRequire(import.meta.url);
async function fixture({user='owner',nonce='a'.repeat(64),consumed=false,expired=false}={}){
 const intent={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',user_id:'owner',workspace_id:'owned-workspace',nonce_hash:createHash('sha256').update('a'.repeat(64)).digest('hex'),expires_at:new Date(Date.now()+(expired?-1000:60000)).toISOString(),status:consumed?'consumed':'authorized',credentials_cipher:'encrypted-private-receipt'};
 let decrypts=0,rpcs=0,deleted=0;const owners=[],calls=[];
 const policySource=await readFile('src/lib/catalog/paid-connect-policy.ts','utf8'),policyModule={exports:{}};
 new Function('require','exports','module',ts.transpileModule(policySource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(require,policyModule.exports,policyModule);
 const deps={
  'server-only':{},'next/headers':{cookies:async()=>({get:()=>({value:nonce}),delete:()=>{deleted++;}})},
  '@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:user?{id:user}:null}})}})},
  '@/lib/supabase/admin':{createAdminClient:()=>({from(){const q={select:()=>q,eq:()=>q,gt:()=>q,maybeSingle:async()=>({data:intent,error:null})};return q;},rpc:async(name,args)=>{rpcs++;calls.push({name,args});intent.status='consumed';return {data:'saved-account',error:null};}})},
  './auth':{catalogStoreOwner:async ws=>{owners.push(ws);}},
  './security':{encryptCatalogSecret:()=> 'encrypted-token',decryptCatalogSecret:()=>{decrypts++;return JSON.stringify({token:'private-token-sentinel',accounts:[{id:'11',name:'Authorized account'}],expiresAt:null});}},
  './paid-connect-policy':policyModule.exports
 };
 const source=await readFile('src/lib/catalog/paid-accounts.ts','utf8'),module={exports:{}};
 new Function('require','exports','module',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>id in deps?deps[id]:require(id),module.exports,module);
 return {api:module.exports,intent,state:()=>({decrypts,rpcs,deleted,owners,calls})};
}
test('foreign actor, changed browser nonce, expiry and consumed receipt fail before credential decryption',async()=>{
 for(const options of [{user:'other'},{user:null},{nonce:'b'.repeat(64)},{expired:true},{consumed:true}]){const f=await fixture(options);await assert.rejects(()=>f.api.paidAccountChoices(f.intent.id,'owned-workspace'));assert.equal(f.state().decrypts,0);assert.equal(f.state().rpcs,0);}
});
test('a valid receipt cannot be reassigned to a different workspace',async()=>{
 const f=await fixture();await assert.rejects(()=>f.api.paidAccountChoices(f.intent.id,'foreign-workspace'));assert.equal(f.state().decrypts,0);assert.equal(f.state().rpcs,0);
});
test('the selected account must be in the provider-verified receipt',async()=>{
 const f=await fixture();await assert.rejects(()=>f.api.savePaidAccount(f.intent.id,'owned-workspace','99'));assert.equal(f.state().rpcs,0);assert.equal(f.state().deleted,0);
});
test('account finalization uses verified actor, encrypted token and a one-use receipt',async()=>{
 const f=await fixture();assert.equal(await f.api.savePaidAccount(f.intent.id,'owned-workspace','11'),'saved-account');const call=f.state().calls[0];assert.equal(call.args.actor,'owner');assert.equal(call.args.external,'11');assert.equal(call.args.encrypted_token,'encrypted-token');assert.equal(JSON.stringify(call).includes('private-token-sentinel'),false);assert.equal(f.state().deleted,1);await assert.rejects(()=>f.api.savePaidAccount(f.intent.id,'owned-workspace','11'));assert.equal(f.state().rpcs,1);
});
