import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { handleZernioWebhook, validWebhookSignature, MAX_WEBHOOK_BYTES, type WebhookOperation } from "../src/lib/social/webhook.ts";

const secret = "test-only-webhook-secret";
const sample = {
  id: "60000000-0000-4000-8000-000000000001",
  event: "post.published", timestamp: "2026-10-30T15:00:00Z",
  post: { id: "provider-post", status: "published", platforms: [
    { platform: "instagram", status: "published", accountId: "account", publishedUrl: "https://example.invalid/post" },
  ] },
};
function request(body: unknown = sample, extra: Record<string,string> = {}) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return new Request("https://example.invalid/api/webhooks/zernio", {
    method: "POST", body: raw,
    headers: { "x-zernio-signature": createHmac("sha256",secret).update(raw).digest("hex"), ...extra },
  });
}
test("signature verification binds exact bytes and rejects malformed digests", () => {
  const raw = JSON.stringify(sample);
  const signature = createHmac("sha256",secret).update(raw).digest("hex");
  assert.equal(validWebhookSignature(raw,signature,secret),true);
  for (const header of [null,"",signature.slice(1),"g".repeat(64),signature.toUpperCase()]) {
    assert.equal(validWebhookSignature(raw,header,secret),false);
  }
  assert.equal(validWebhookSignature(raw+" ",signature,secret),false);
  assert.equal(validWebhookSignature(raw,signature,undefined),false);
});
test("unauthenticated input cannot reach the database", async () => {
  let calls=0;
  const response=await handleZernioWebhook(request(sample,{"x-zernio-signature":"0".repeat(64)}),{
    secret, apply:async()=>{calls++;return true;},
  });
  assert.equal(response.status,401); assert.equal(calls,0);
});
test("missing secret returns a retryable server error", async () => {
  const response=await handleZernioWebhook(request(),{apply:async()=>{throw new Error("must not run");}});
  assert.equal(response.status,503);
});
test("malformed JSON and invalid signed envelopes return 400 without writes", async () => {
  for (const body of ["{",null,[],{}, {...sample,id:"not-a-uuid"}, {...sample,timestamp:"yesterday"},
    {...sample,post:{id:"",status:"published",platforms:[]}},
    {...sample,post:{id:"post",status:"published",platforms:[null]}},
    {...sample,post:{id:"post",status:"unknown",platforms:[]}}]) {
    const response=await handleZernioWebhook(request(body),{secret,apply:async()=>{throw new Error("must not run");}});
    assert.equal(response.status,400);
  }
});
test("stream size limit applies without trusting Content-Length", async () => {
  const response=await handleZernioWebhook(request("x".repeat(MAX_WEBHOOK_BYTES+1),{"content-length":"1"}),{
    secret, apply:async()=>{throw new Error("must not run");},
  });
  assert.equal(response.status,413);
});
test("test deliveries and unsupported families are acknowledged without mutations", async () => {
  for (const body of [{...sample,test:true},{...sample,event:"webhook.test"},{...sample,event:"post.recycled"},
    {...sample,event:"post.external.created"},{...sample,event:"message.received"}]) {
    const response=await handleZernioWebhook(request(body),{secret,apply:async()=>{throw new Error("must not run");}});
    assert.equal(response.status,200);
  }
});
test("signed body ID is canonical and cannot be overridden by a header", async () => {
  const response=await handleZernioWebhook(request(sample,{"x-zernio-event-id":crypto.randomUUID()}),{
    secret,apply:async()=>{throw new Error("must not run");},
  });
  assert.equal(response.status,400);
});
test("valid post snapshots are normalized; duplicate receipts return 200", async () => {
  for (const receipt of [true,false]) {
    let operation: WebhookOperation | undefined;
    const response=await handleZernioWebhook(request(),{secret,apply:async value=>{operation=value;return receipt;}});
    assert.equal(response.status,200);
    assert.equal(operation?.event_id,sample.id);
    assert.equal(operation?.target_id,"provider-post");
    assert.equal(operation?.post_status,"published");
    assert.equal(operation?.post_results[0].account_id,"account");
    assert.match(operation?.body_hash ?? "",/^[a-f0-9]{64}$/);
  }
});
test("per-platform events use the overall snapshot status, not their suffix", async () => {
  const response=await handleZernioWebhook(request({...sample,event:"post.platform.published",post:{...sample.post,status:"publishing"}}),{
    secret,apply:async operation=>{assert.equal(operation.post_status,"publishing");return true;},
  });
  assert.equal(response.status,200);
});
test("account disconnect validates account/profile IDs without falling back to event ID", async () => {
  const body={...sample,event:"account.disconnected",account:{accountId:"account",profileId:"profile"}};
  const good=await handleZernioWebhook(request(body),{secret,apply:async operation=>{
    assert.equal(operation.target_id,"account");assert.equal(operation.profile_id,"profile");return true;
  }});
  assert.equal(good.status,200);
  const bad=await handleZernioWebhook(request({...body,account:{}}),{secret,apply:async()=>true});
  assert.equal(bad.status,400);
});
test("database failure is retryable and logging omits body, secret and database message", async () => {
  const calls: WebhookOperation[]=[];
  const reports: unknown[]=[];
  const dependencies={secret,apply:async (operation:WebhookOperation)=>{
    calls.push(operation);
    if(calls.length===1)throw {code:"08006",message:"private database details",payload:sample};
    return false; // First transaction may have committed before its response was lost.
  },report:(details:unknown)=>reports.push(details)};
  const failed=await handleZernioWebhook(request(),dependencies);
  const retried=await handleZernioWebhook(request(),dependencies);
  assert.equal(failed.status,503);assert.equal(failed.headers.get("Retry-After"),"10");
  assert.equal(retried.status,200);assert.deepEqual(calls[0],calls[1]);
  assert.deepEqual(reports,[{eventId:sample.id,event:"post.published",code:"08006"}]);
});
test("legacy signature alias remains supported", async () => {
  const req=request();
  const signature=req.headers.get("x-zernio-signature")!;
  req.headers.delete("x-zernio-signature");req.headers.set("x-late-signature",signature);
  const response=await handleZernioWebhook(req,{secret,apply:async()=>true});
  assert.equal(response.status,200);
});
