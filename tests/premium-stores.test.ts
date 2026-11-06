import {test} from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {Readable} from "node:stream";
import {storeAddress,storeKey,providerInstallUrl,verifyWixInstance} from "../src/lib/stores/providers.ts";
import {fetchPublicUrl} from "../src/lib/public-fetch.ts";
test("native connections reject unsafe addresses and bind store identity",()=>{
 assert.equal(storeKey("https://www.store.example/"),storeKey("https://store.example"));
 assert.notEqual(storeKey("https://user.wixsite.com/site-a"),storeKey("https://user.wixsite.com/site-b"));
 for(const value of ["http://store.example","https://127.0.0.1","https://169.254.169.254","https://user:pass@store.example","https://[::1]"])assert.throws(()=>storeAddress(value));
});
test("platform buttons initiate native consent flows with read-only permissions",()=>{
 process.env.SQUARESPACE_CLIENT_ID="ss-client";process.env.BIGCOMMERCE_CLIENT_ID="bc-client";process.env.WIX_CLIENT_ID="wix-app";process.env.WIX_INSTALL_URL="https://www.wix.com/installer/install";
 const woo=new URL(providerInstallUrl("woocommerce","https://store.example","nonce"));
 assert.equal(woo.pathname,"/wc-auth/v1/authorize");assert.equal(woo.searchParams.get("scope"),"read");assert.equal(woo.searchParams.get("user_id"),"nonce");
 const ss=new URL(providerInstallUrl("squarespace","https://store.example","nonce"));
 assert.equal(ss.hostname,"login.squarespace.com");assert.equal(ss.searchParams.get("state"),"nonce");assert.equal(ss.searchParams.get("scope"),"website.products.read,website.inventory.read");assert.equal(ss.searchParams.get("access_type"),"offline");
 assert.equal(providerInstallUrl("bigcommerce","https://store.example","nonce"),"https://login.bigcommerce.com/app/bc-client/install");
 const wix=new URL(providerInstallUrl("wix","https://store.example","nonce"));
 assert.equal(new URL(wix.searchParams.get("postInstallationUrl")!).searchParams.get("state"),"nonce");assert.equal(wix.searchParams.has("redirectUrl"),false,"No deprecated Wix custom-auth flow");
});
test("Wix install proof must be signed, current and for the returned instance",()=>{
 const secret="fixture-secret",instance="fixture-instance",payload=Buffer.from(JSON.stringify({instanceId:instance,signDate:new Date().toISOString()})).toString("base64url");
 const signed=createHmac("sha256",secret).update(payload).digest("base64url")+"."+payload;
 assert.equal(verifyWixInstance(signed,instance,secret).instanceId,instance);
 assert.throws(()=>verifyWixInstance(signed,"different",secret));assert.throws(()=>verifyWixInstance(signed,instance,"wrong"));
 const old=Buffer.from(JSON.stringify({instanceId:instance,signDate:"2020-01-01T00:00:00Z"})).toString("base64url");
 assert.throws(()=>verifyWixInstance(createHmac("sha256",secret).update(old).digest("base64url")+"."+old,instance,secret));
});
test("WooCommerce credentials are DNS-pinned and cannot follow a cross-origin redirect",async()=>{
 const requests:{url:string;auth?:string}[]=[];
 const deps={resolve:async()=>[{address:"93.184.216.34",family:4}],request:async(url:URL,address:unknown,signal:AbortSignal,options:{authorization?:string})=>{
  requests.push({url:url.toString(),auth:options.authorization});
  return {status:302,headers:{location:"https://attacker.example/steal"},body:Readable.from([])};
 }};
 await assert.rejects(fetchPublicUrl("https://store.example/wp-json/wc/v3/products",{maxBytes:1024,authorization:{origin:"https://store.example",value:"Basic Zml4dHVyZQ=="}},deps),/redirect|unsafe/i);
 assert.equal(requests.length,1);assert.equal(requests[0].auth,"Basic Zml4dHVyZQ==");
 await assert.rejects(fetchPublicUrl("https://store.example/wp-json/wc/v3/products",{maxBytes:1024,authorization:{origin:"https://different.example",value:"Basic Zml4dHVyZQ=="}},deps));
});
