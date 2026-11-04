import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {POLICY_IDS,LEGAL_POLICY_VERSION,LEGAL_OPERATOR_NAME,LEGAL_BUSINESS_ADDRESS,LEGAL_DOCUMENT_STATUS,PAID_CHECKOUT_STATUS,isPolicyId,policyPath,PRIVACY_REQUESTS,privacyRequestHref} from "../src/lib/legal-policy.ts";
test("pre-launch policies cannot represent a finalized operator or activate checkout",async()=>{
 const data=JSON.parse(await readFile(new URL("../src/lib/legal-documents.json",import.meta.url),"utf8"));
 assert.ok(!/pre[-\s]?launch|unspecified|pending entity formation|not (?:yet )?finalized|draft (?:terms|policies)/i.test(JSON.stringify(data.documents)));
 assert.equal(data.version,LEGAL_POLICY_VERSION);assert.equal(LEGAL_DOCUMENT_STATUS,"prelaunch-review");
 assert.equal(LEGAL_OPERATOR_NAME,null);assert.equal(LEGAL_BUSINESS_ADDRESS,null);assert.equal(PAID_CHECKOUT_STATUS,"unavailable");
 assert.deepEqual(Object.keys(data.documents).sort(),[...POLICY_IDS].sort());
 for(const id of POLICY_IDS){assert.ok(isPolicyId(id));assert.ok(policyPath(id).startsWith("/"));assert.ok(data.documents[id].sections.length>0);}
 for(const id of ["__proto__","constructor","https://evil.example","../terms",null])assert.equal(isPolicyId(id),false);
 const privacy=JSON.stringify(data.documents.privacy);
 assert.ok(privacy.includes("Zernio"));assert.ok(privacy.includes("face template"));assert.ok(privacy.toLowerCase().includes("provider-by-provider"));
 assert.ok(JSON.stringify(data.documents.terms).includes("does not guarantee exclusivity"));
 assert.ok(JSON.stringify(data.documents.billing).includes("explicit authorization"));
});
test("privacy requests open email drafts without identifying or deleting an account",()=>{
 for(const kind of Object.keys(PRIVACY_REQUESTS) as (keyof typeof PRIVACY_REQUESTS)[]){
  const link=new URL(privacyRequestHref(kind));assert.equal(link.protocol,"mailto:");assert.equal(link.pathname,"hello@gooidy.com");
  assert.ok(link.searchParams.get("subject")?.includes(kind));assert.ok(link.searchParams.get("body")?.includes("verification"));
  assert.ok(!link.searchParams.has("email"));assert.ok(!link.searchParams.has("user_id"));assert.ok(!privacyRequestHref(kind).includes("+"));
 }
});
