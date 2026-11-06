import {test} from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {shopDomain,callbackValid,rawWebhookValid,hasScopes,authorizationUrl} from "../src/lib/shopify/security.ts";
test("store destination rejects SSRF and deceptive hosts",()=>{
 assert.equal(shopDomain("https://soft-mila.myshopify.com/"),"soft-mila.myshopify.com");
 for(const value of ["softmila.com","shop.myshopify.com.evil.com","https://evil.com@shop.myshopify.com","shop.myshopify.com:443","127.0.0.1","shop.myshopify.com/path","shop.myshopify.com?x=1"])assert.throws(()=>shopDomain(value));
});
test("OAuth HMAC matches Shopify query encoding, rejects tampering, repeats and stale responses",()=>{
 const secret="fixture-secret",now=1794000000000;
 const p=new URLSearchParams({code:"abc",host:"YWRtaW4=",shop:"shop.myshopify.com",state:"nonce",timestamp:"1794000000"});
 // Literal encoded message follows Shopify's ProcessedQuery implementation.
 const signature=createHmac("sha256",secret).update("code=abc&host=YWRtaW4%3D&shop=shop.myshopify.com&state=nonce&timestamp=1794000000").digest("hex");
 p.set("hmac",signature);assert.equal(callbackValid(p,secret,now),true);
 assert.equal(callbackValid(p,secret,now+700000),false);
 p.append("shop","attacker.myshopify.com");assert.equal(callbackValid(p,secret,now),false);
 p.delete("shop");p.set("shop","attacker.myshopify.com");assert.equal(callbackValid(p,secret,now),false);
});
test("webhook verification uses raw bytes, scopes are read only",()=>{
 const body=Buffer.from('{"id":1}'),secret="fixture",sig=createHmac("sha256",secret).update(body).digest("base64");
 assert.equal(rawWebhookValid(body,sig,secret),true);assert.equal(rawWebhookValid(Buffer.from('{"id":2}'),sig,secret),false);
 assert.equal(hasScopes("read_products,read_inventory"),true);assert.equal(hasScopes("read_products"),false);
 process.env.SHOPIFY_CLIENT_ID="fixture";
 const url=new URL(authorizationUrl("store.myshopify.com","nonce"));
 assert.equal(url.hostname,"store.myshopify.com");assert.equal(url.searchParams.get("scope"),"read_products,read_inventory");
 assert.equal(url.searchParams.get("redirect_uri"),"https://gooidy.com/api/shopify/callback");
});
