import test from "node:test";
import assert from "node:assert/strict";
import {catalogWorkerConfigurationIssues} from "../src/lib/catalog/security.ts";
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
