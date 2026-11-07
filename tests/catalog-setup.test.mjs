import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
const base={PATH:process.env.PATH,VERCEL_ENV:"production",CATALOG_INGESTION_ENABLED:"true",CATALOG_ENCRYPTION_KEY:"a1".repeat(32),INNGEST_EVENT_KEY:"sentinel-event-secret",INNGEST_SIGNING_KEY:"sentinel-signing-secret",INNGEST_SERVE_ORIGIN:"https://gooidy.com",SHOPIFY_CONNECT_ENABLED:"true",SHOPIFY_CLIENT_ID:"sentinel-client",SHOPIFY_CLIENT_SECRET:"sentinel-shopify-secret",SHOPIFY_APP_ORIGIN:"https://gooidy.com"};
function run(env,args=[]){const result=spawnSync(process.execPath,["--experimental-strip-types","scripts/check-catalog-setup.mjs",...args],{env,encoding:"utf8"});assert.ifError(result.error);return result;}
test("an empty setup fails with names only and does not claim live readiness",()=>{
 const r=run({PATH:process.env.PATH},["--json"]);assert.equal(r.status,1);const data=JSON.parse(r.stdout);assert.equal(data.configured,false);assert.equal(data.liveServicesVerified,false);assert.equal(data.checks.find(c=>c.name==="SHOPIFY_CLIENT_SECRET").status,"missing");
});
test("configured store sync does not require or enable training",()=>{
 const r=run(base,["--json"]);assert.equal(r.status,0);const data=JSON.parse(r.stdout);assert.equal(data.configured,true);assert.equal(data.liveServicesVerified,false);assert.equal(data.checks.some(c=>c.name.startsWith("REPLICATE")),false);
 for(const value of [base.CATALOG_ENCRYPTION_KEY,base.INNGEST_EVENT_KEY,base.INNGEST_SIGNING_KEY,base.SHOPIFY_CLIENT_SECRET])assert.equal((r.stdout+r.stderr).includes(value),false);
});
test("preview runtimes, disabled flags, invalid encryption and placeholder secrets fail",()=>{
 for(const patch of [{VERCEL_ENV:"preview"},{SHOPIFY_CONNECT_ENABLED:"false"},{CATALOG_ENCRYPTION_KEY:"short"},{SHOPIFY_CLIENT_SECRET:"REPLACE_ME"},{SHOPIFY_APP_ORIGIN:"https://wrong.example"},{INNGEST_SERVE_ORIGIN:"https://wrong.example"}])assert.equal(run({...base,...patch}).status,1);
});
test("pilot checks require explicit product, pinned trainer and destination without exposing them",()=>{
 assert.equal(run(base,["--training"]).status,1);
 const pilot={...base,CATALOG_TRAINING_ENABLED:"true",CATALOG_PILOT_WORKSPACE_ID:"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",CATALOG_PILOT_PRODUCT_URL:"https://www.softmila.com/products/mens-raglan-lounge-set",REPLICATE_API_TOKEN:"sentinel-replicate-secret",REPLICATE_TRAINER_VERSION:"b".repeat(64),REPLICATE_TRAINING_DESTINATION:"sentinel/private-model"};
 const result=run(pilot,["--training","--json"]);assert.equal(result.status,0);const data=JSON.parse(result.stdout);assert.equal(data.liveServicesVerified,false);for(const key of ["REPLICATE_API_TOKEN","REPLICATE_TRAINER_VERSION","REPLICATE_TRAINING_DESTINATION","CATALOG_PILOT_PRODUCT_URL","CATALOG_PILOT_WORKSPACE_ID"])assert.equal((result.stdout+result.stderr).includes(pilot[key]),false);
 for(const patch of [{REPLICATE_TRAINING_DESTINATION:"bad"},{REPLICATE_TRAINER_VERSION:"latest"},{CATALOG_PILOT_WORKSPACE_ID:"unknown"},{CATALOG_PILOT_PRODUCT_URL:"http://example.test/product"}])assert.equal(run({...pilot,...patch},["--training"]).status,1);
});
test("unknown arguments fail without reading or logging configuration",()=>{const r=run(base,["--enable-training"]);assert.equal(r.status,2);assert.equal(r.stdout,"");assert.match(r.stderr,/Usage:/);});
