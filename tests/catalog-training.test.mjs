import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function load(file,mocks){
 const js=ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 vm.runInNewContext(js,{exports:module.exports,module,require:(id)=>{if(id in mocks)return mocks[id];throw new Error("Unmocked dependency "+id);},process,Date,console},{filename:file});
 return module.exports;
}
test("lost paid submission response is never retried on replay",async()=>{
 let creates=0,claims=0;
 const job={status:"dataset_ready",workspace_id:"w",catalog_items:{product_url:"https://store.example/p",connection_id:"c"},dataset_path:"private.zip",destination:"private/model",trainer_version:"a".repeat(64)};
 const chain={select(){return this;},eq(){return this;},is(){return this;},update(p){Object.assign(job,p);return this;},async single(){return {data:job,error:null};},then(resolve){resolve({error:null});}};
 const db={from(table){if(table==="catalog_connections")return {select(){return this;},eq(){return this;},async single(){return {data:{enabled:true}};}};return chain;},storage:{from(){return {async createSignedUrl(){return {data:{signedUrl:"https://private.example/signed"}};}};}},async rpc(){claims++;if(job.status!=="dataset_ready")return {data:false};job.status="submitting";return {data:true};}};
 const training=load("src/lib/catalog/training.ts",{
 "server-only":{},"@/lib/supabase/admin":{createAdminClient:()=>db},
 "./replicate":{async createTraining(){creates++;throw new Error("response lost");}},
 "./store":{async jobStatus(id,p){Object.assign(job,p);}},"./security":{trainingAllowed:()=>true}
 });
 assert.equal((await training.submitCatalogTraining("job")).unknown,true);
 assert.equal(job.status,"submission_unknown");
 for(let i=0;i<10;i++)await training.submitCatalogTraining("job");
 assert.equal(creates,1);assert.equal(claims,1);
});
test("disabled training never signs data or submits",async()=>{
 const training=load("src/lib/catalog/training.ts",{
 "server-only":{},"@/lib/supabase/admin":{createAdminClient:()=>({from(){return {select(){return this;},eq(){return this;},async single(){return {data:{status:"dataset_ready",workspace_id:"w",catalog_items:{product_url:"p"}}};}};}})},
 "./replicate":{createTraining(){throw new Error("must not call provider");}},
 "./store":{},"./security":{trainingAllowed:()=>false}
 });
 assert.equal((await training.submitCatalogTraining("job")).submitted,false);
});
test("insufficient source imagery blocks before download or paid submission",async()=>{
 let saved;
 const dataset=load("src/lib/catalog/dataset.ts",{
 "server-only":{},"node:crypto":{createHash(){throw new Error("no hashing needed");}},
 sharp(){throw new Error("must not process");},fflate:{},
 "@/lib/public-fetch":{fetchPublicUrl(){throw new Error("must not fetch");}},
 "@/lib/supabase/admin":{createAdminClient:()=>({from(table){return {select(){return this;},eq(){return this;},async single(){return {data:table==="catalog_connections"?{enabled:true}:{status:"queued",workspace_id:"w",image_revision:"a",catalog_items:{image_revision:"a",product_url:"p",connection_id:"c",images:["single.jpg"]}}};}};}})},
 "./store":{async jobStatus(id,p){saved=p;}},"./security":{trainingAllowed:()=>true},"./replicate":{}
 });
 assert.equal(await dataset.prepareTrainingDataset("job"),false);
 assert.equal(saved.error_code,"INSUFFICIENT_SOURCE_IMAGES");
});
