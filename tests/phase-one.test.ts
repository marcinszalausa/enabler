import {test} from "node:test";
import assert from "node:assert/strict";
import {shopifyQuantity,inventorySignalId} from "../src/lib/catalog/inventory-policy.ts";
import {pausePaidAd,type PaidBinding} from "../src/lib/catalog/paid-ad-pause.ts";
import {trainingSetup,selectedPhotoKeys} from "../src/lib/catalog/training-policy.ts";
import {paidIntentMatches} from "../src/lib/catalog/paid-connect-policy.ts";
import {createHash} from "node:crypto";
test("paid OAuth receipt is bound to the same authenticated actor, browser nonce and expiry",()=>{
 const nonce="a".repeat(64),now=Date.now(),intent={user_id:"owner",nonce_hash:createHash("sha256").update(nonce).digest("hex"),expires_at:new Date(now+60000).toISOString(),status:"authorized"};
 assert.equal(paidIntentMatches(intent,"owner",nonce,now),true);
 assert.equal(paidIntentMatches(intent,"other",nonce,now),false);
 assert.equal(paidIntentMatches(intent,"owner","b".repeat(64),now),false);
 assert.equal(paidIntentMatches({...intent,status:"consumed"},"owner",nonce,now),false);
 assert.equal(paidIntentMatches(intent,"owner",nonce,now+60001),false);
});
test("zero stock is only authoritative after all variants are known tracked",()=>{
 assert.equal(shopifyQuantity({tracksInventory:false,totalInventory:0}),null);
 assert.equal(shopifyQuantity({tracksInventory:true,totalInventory:0}),null);
 assert.equal(shopifyQuantity({tracksInventory:true,totalInventory:0,allVariantsTracked:true}),0);
 assert.equal(shopifyQuantity({tracksInventory:true,totalInventory:8}),8);
 assert.equal(shopifyQuantity({status:"ARCHIVED",tracksInventory:false,totalInventory:100}),0);
 assert.throws(()=>inventorySignalId("1/../../wrong"));
});
test("provider setup and a confirmed hard cap are both required for paid training",()=>{
 const env={REPLICATE_API_TOKEN:"fixture",REPLICATE_TRAINER_VERSION:"a".repeat(64),REPLICATE_TRAINING_DESTINATION:"fixture/private",CATALOG_TRAINING_ENABLED:"true"};
 assert.equal(trainingSetup(env).configured,true);assert.equal(trainingSetup(env).spendingEnabled,false);
 assert.equal(trainingSetup({...env,CATALOG_PROVIDER_HARD_CAP_CONFIRMED:"true"}).spendingEnabled,true);
 assert.throws(()=>selectedPhotoKeys(Array(10).fill("store:0")));
 assert.equal(selectedPhotoKeys(Array.from({length:10},(_,i)=>"store:"+i)).length,10);
});
test("Meta pause verifies ownership, pauses only, then requires confirmation",async()=>{
 let paused=false;const calls:{url:string;init?:RequestInit}[]=[];
 const request=(async(url:RequestInfo|URL,init?:RequestInit)=>{calls.push({url:String(url),init});if(init?.method==="POST"){assert.equal(String(init.body),"status=PAUSED");paused=true;return Response.json({success:true});}return Response.json({id:"22",account_id:"11",configured_status:paused?"PAUSED":"ACTIVE"});}) as typeof fetch;
 await pausePaidAd({provider:"meta",accountId:"11",adId:"22",token:"fixture-token"},request,"v25.0");
 assert.equal(calls.length,3);assert.ok(calls.every(c=>!c.url.includes("fixture-token")&&c.init?.redirect==="error"));
});
test("wrong ad account never receives a mutation",async()=>{
 let posts=0;const request=(async(_url:RequestInfo|URL,init?:RequestInit)=>{if(init?.method==="POST")posts++;return Response.json({id:"22",account_id:"other",configured_status:"ACTIVE"});}) as typeof fetch;
 await assert.rejects(()=>pausePaidAd({provider:"meta",accountId:"11",adId:"22",token:"fixture"},request,"v25.0"),/ACCOUNT_MISMATCH/);assert.equal(posts,0);
});
test("a successful mutation response alone is not proof that an ad is paused",async()=>{
 const request=(async(_url:RequestInfo|URL,init?:RequestInit)=>Response.json(init?.method==="POST"?{success:true}:{id:"22",account_id:"11",configured_status:"ACTIVE"})) as typeof fetch;
 await assert.rejects(()=>pausePaidAd({provider:"meta",accountId:"11",adId:"22",token:"fixture"},request,"v25.0"),/UNCONFIRMED/);
});
test("TikTok adapter disables only the bound advertiser's ad and confirms state",async()=>{
 let disabled=false;const request=(async(url:RequestInfo|URL,init?:RequestInit)=>{if(init?.method==="POST"){const body=JSON.parse(String(init.body));assert.deepEqual(body,{advertiser_id:"11",ad_ids:["22"],operation_status:"DISABLE"});disabled=true;return Response.json({code:0});}assert.ok(String(url).startsWith("https://business-api.tiktok.com/"));return Response.json({code:0,data:{list:[{ad_id:"22",advertiser_id:"11",operation_status:disabled?"DISABLE":"ENABLE"}]}});}) as typeof fetch;
 const binding:PaidBinding={provider:"tiktok",accountId:"11",adId:"22",token:"fixture"};await pausePaidAd(binding,request);assert.equal(disabled,true);
});
