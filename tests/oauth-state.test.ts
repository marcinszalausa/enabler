import test from "node:test";
import assert from "node:assert/strict";
import { newSocialConnectNonce, hashSocialConnectNonce, socialConnectCookie, callbackUrlForOrigin, authorizeSocialCallback, SOCIAL_STATE_PARAM } from "../src/lib/social/oauth-state.ts";

const context={workspace_id:"workspace-a",profile_id:"profile-a",platform:"instagram"};
function params(nonce:string){
  return new URLSearchParams({[SOCIAL_STATE_PARAM]:nonce,profileId:"profile-a",connected:"instagram"});
}
test("connection nonces have 256 bits of entropy and only hashes cross the DB boundary",()=>{
  const a=newSocialConnectNonce(),b=newSocialConnectNonce();
  assert.match(a,/^[A-Za-z0-9_-]{43}$/);assert.notEqual(a,b);
  assert.match(hashSocialConnectNonce(a),/^[a-f0-9]{64}$/);
  assert.notEqual(hashSocialConnectNonce(a),a);
  assert.throws(()=>hashSocialConnectNonce("short"));
});
test("production uses a host-only secure HttpOnly cookie with a short lifetime",()=>{
  const cookie=socialConnectCookie(true);
  assert.equal(cookie.name,"__Host-gooidy-social-state");
  assert.deepEqual(cookie.options,{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:600});
  assert.equal("domain" in cookie.options,false);
  assert.equal(socialConnectCookie(false).options.secure,false);
});
test("callback origins are trusted and the custom nonce parameter survives URL construction",()=>{
  const nonce=newSocialConnectNonce();
  const url=new URL(callbackUrlForOrigin("https://gooidy.com",nonce,true));
  assert.equal(url.pathname,"/api/social/callback");assert.equal(url.searchParams.get(SOCIAL_STATE_PARAM),nonce);
  assert.match(callbackUrlForOrigin("https://preview.vercel.app",nonce,true,["preview.vercel.app"]),/^https:\/\/preview.vercel.app\//);
  assert.match(callbackUrlForOrigin("http://localhost:3000",nonce,false),/^http:\/\/localhost:3000\//);
  for(const origin of ["https://evil.example","https://gooidy.com.evil.example","http://gooidy.com","http://localhost:3000","https://user:pass@gooidy.com"]){
    assert.throws(()=>callbackUrlForOrigin(origin,nonce,true));
  }
});
test("missing, malformed, duplicated or mismatched nonce/cookie pairs never query the database",async()=>{
  const nonce=newSocialConnectNonce();
  const values=[
    {query:params(nonce),cookie:undefined},
    {query:params("short"),cookie:nonce},
    {query:params(nonce),cookie:"short"},
    {query:params(nonce),cookie:newSocialConnectNonce()},
    {query:new URLSearchParams(),cookie:nonce},
  ];
  const duplicated=params(nonce);duplicated.append(SOCIAL_STATE_PARAM,nonce);
  values.push({query:duplicated,cookie:nonce});
  for(const value of values){
    assert.equal(await authorizeSocialCallback(value.query,value.cookie,"user",async()=>{throw new Error("must not query");}),null);
  }
});
test("a valid callback consumes the hashed nonce for the verified user",async()=>{
  const nonce=newSocialConnectNonce();
  const actual=await authorizeSocialCallback(params(nonce),nonce,"verified-user",async(hash,user)=>{
    assert.equal(hash,hashSocialConnectNonce(nonce));assert.equal(user,"verified-user");return context;
  });
  assert.deepEqual(actual,context);
});
test("profile/platform mismatches and duplicated resource parameters cannot pass the gate",async()=>{
  const nonce=newSocialConnectNonce();
  for(const field of ["profileId","connected"]){
    const mismatch=params(nonce);mismatch.set(field,"other");
    assert.equal(await authorizeSocialCallback(mismatch,nonce,"user",async()=>context),null);
    const duplicate=params(nonce);duplicate.append(field,duplicate.get(field)!);
    assert.equal(await authorizeSocialCallback(duplicate,nonce,"user",async()=>context),null);
  }
});
test("expired, revoked and previously consumed server records are rejected",async()=>{
  const nonce=newSocialConnectNonce();
  assert.equal(await authorizeSocialCallback(params(nonce),nonce,"user",async()=>null),null);
  await assert.rejects(authorizeSocialCallback(params(nonce),nonce,"user",async()=>{throw new Error("DB unavailable");}),/DB unavailable/);
});
test("a replay cannot pass after successful server consumption",async()=>{
  const nonce=newSocialConnectNonce();let consumed=false;
  const consume=async()=>{if(consumed)return null;consumed=true;return context;};
  assert.deepEqual(await authorizeSocialCallback(params(nonce),nonce,"user",consume),context);
  assert.equal(await authorizeSocialCallback(params(nonce),nonce,"user",consume),null);
});
test("provider cancellations still require browser and server state",async()=>{
  const nonce=newSocialConnectNonce();
  const cancelled=new URLSearchParams({[SOCIAL_STATE_PARAM]:nonce,error:"access_denied"});
  assert.deepEqual(await authorizeSocialCallback(cancelled,nonce,"user",async()=>context),context);
  assert.equal(await authorizeSocialCallback(cancelled,undefined,"user",async()=>context),null);
});
