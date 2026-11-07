import test from "node:test";
import assert from "node:assert/strict";
import {catalogWorkerConfigurationIssues,catalogWorkerConfigurationDetails} from "../src/lib/catalog/security.ts";
const ready={CATALOG_INGESTION_ENABLED:"true",CATALOG_ENCRYPTION_KEY:"12".repeat(32),INNGEST_SIGNING_KEY:"private-signing-key-sentinel"};
test("missing worker configuration identifies only actionable setting names",()=>{
 assert.deepEqual(catalogWorkerConfigurationIssues({}),["CATALOG_INGESTION_ENABLED","CATALOG_ENCRYPTION_KEY","INNGEST_SIGNING_KEY"]);
 assert.deepEqual(catalogWorkerConfigurationIssues(ready),[]);
});
test("disabled flags, malformed encryption and blank signing keys fail closed",()=>{
 for(const [name,value] of [["CATALOG_INGESTION_ENABLED","TRUE"],["CATALOG_ENCRYPTION_KEY","123"],["INNGEST_SIGNING_KEY"," "]]){
  assert.deepEqual(catalogWorkerConfigurationIssues({...ready,[name]:value}),[name]);
 }
});
test("diagnostics never return any supplied values or unrelated secrets",()=>{
 const env={...ready,CATALOG_ENCRYPTION_KEY:"private-bad-encryption-sentinel",REPLICATE_API_TOKEN:"unrelated-secret-sentinel"};
 const result=JSON.stringify(catalogWorkerConfigurationIssues(env));
 assert.equal(result.includes(env.CATALOG_ENCRYPTION_KEY),false);
 assert.equal(result.includes(env.INNGEST_SIGNING_KEY),false);
 assert.equal(result.includes(env.REPLICATE_API_TOKEN),false);
 assert.match(result,/CATALOG_ENCRYPTION_KEY/);
});

test("operator can distinguish an absent key, wrong length and unsupported characters without seeing it",()=>{
 assert.equal(catalogWorkerConfigurationDetails({}).CATALOG_ENCRYPTION_KEY,"missing");
 assert.equal(catalogWorkerConfigurationDetails({...ready,CATALOG_ENCRYPTION_KEY:"123"}).CATALOG_ENCRYPTION_KEY,"wrong_length");
 assert.equal(catalogWorkerConfigurationDetails({...ready,CATALOG_ENCRYPTION_KEY:"z".repeat(64)}).CATALOG_ENCRYPTION_KEY,"not_hexadecimal");
 assert.deepEqual(catalogWorkerConfigurationDetails(ready),{});
 const raw="private-sentinel";
 assert.equal(JSON.stringify(catalogWorkerConfigurationDetails({...ready,CATALOG_ENCRYPTION_KEY:raw})).includes(raw),false);
});
