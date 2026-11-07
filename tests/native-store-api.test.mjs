import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function moduleAt(file,mocks,fetchMock=()=>{throw new Error("Unexpected external request");}){
 const js=ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,module={exports:{}};
 vm.runInNewContext(js,{module,exports:module.exports,require:id=>{if(id in mocks)return mocks[id];throw new Error("Unmocked "+id);},process,Date,console,URL,URLSearchParams,Response,Request,AbortSignal,Buffer,fetch:fetchMock},{filename:file});return module.exports;
}
const providers={storeAddress:v=>v,callbackUrl:p=>"https://gooidy.com/api/stores/"+p+"/callback",verifyWixInstance(){throw new Error("invalid signed proof");}};
test("Woo approval validates server-delivered read credentials against the intended store",async()=>{
 let request;
 const api=moduleAt("src/lib/stores/api.ts",{"server-only":{},"./providers":providers,"@/lib/public-fetch":{fetchPublicUrl:async(url,options)=>{request={url,options};return {status:200,body:Buffer.from("[]")};}}});
 const params=new URLSearchParams(),body={key_permissions:"read",consumer_key:"ck_"+"a".repeat(40),consumer_secret:"cs_"+"b".repeat(40)};
 const proof=await api.authorizeProof("woocommerce",params,body,"https://store.example");
 assert.equal(proof.providerId,"https://store.example");
 assert.equal(request.options.authorization.origin,"https://store.example");
 assert.match(request.options.authorization.value,/^Basic /);
 assert.ok(!request.url.includes("consumer_secret"));
 await assert.rejects(api.authorizeProof("woocommerce",params,{...body,key_permissions:"read_write"},"https://store.example"));
});
test("Squarespace exchanges offline tokens and verifies the actual website",async()=>{
 const calls=[];
 const api=moduleAt("src/lib/stores/api.ts",{"server-only":{},"./providers":providers,"@/lib/public-fetch":{}},async(url,options)=>{
  calls.push({url,options});
  const data=url.includes("/tokens")?{access_token:"fixture-access",refresh_token:"fixture-refresh",access_token_expires_at:String((Date.now()+1800000)/1000),refresh_token_expires_at:String((Date.now()+604800000)/1000)}:{id:"site",title:"Store",url:"https://store.example"};
  return Response.json(data);
 });
 const proof=await api.authorizeProof("squarespace",new URLSearchParams({code:"authorization-code"}),null,null);
 assert.equal(proof.providerId,"site");assert.equal(proof.storeUrl,"https://store.example");assert.ok(proof.credentials.accessExpiresAt>Date.now());
 assert.equal(calls[1].url,"https://api.squarespace.com/1.0/authorization/website");
 assert.equal(calls[1].options.headers.Authorization,"Bearer fixture-access");
});
test("BigCommerce rejects unsafe context and excessive permissions before token exchange",async()=>{
 const api=moduleAt("src/lib/stores/api.ts",{"server-only":{},"./providers":providers,"@/lib/public-fetch":{}});
 await assert.rejects(api.authorizeProof("bigcommerce",new URLSearchParams({context:"stores/../../internal",scope:"store_v2_products_read_only",code:"code"}),null,null));
 await assert.rejects(api.authorizeProof("bigcommerce",new URLSearchParams({context:"stores/store123",scope:"store_v2_information_read_only store_v2_products_read_only store_v2_orders",code:"code"}),null,null));
});
test("forged Wix install does not mint an app access token",async()=>{
 const api=moduleAt("src/lib/stores/api.ts",{"server-only":{},"./providers":providers,"@/lib/public-fetch":{}});
 await assert.rejects(api.authorizeProof("wix",new URLSearchParams({instanceId:"fake",signedInstance:"fake"}),null,null),/invalid signed proof/);
});
test("native catalog normalization keeps original images and unknown stock, never invents zero",()=>{
 const normalize={canonicalProduct:v=>v},api={obj:v=>{if(!v||typeof v!=="object")throw new Error("object");return v;},str:v=>{if(typeof v!=="string")throw new Error("text");return v;}};
 const catalog=moduleAt("src/lib/stores/catalog.ts",{"server-only":{},"@/lib/supabase/admin":{},"@/lib/catalog/security":{},"@/lib/catalog/access":{},"@/lib/catalog/normalize":normalize,"@/lib/public-fetch":{parsePublicHttpUrl:v=>new URL(v)},"./providers":{},"./api":api});
 const c={store_origin:"https://store.example"};
 const woo=catalog.nativeProduct("woocommerce",{id:1,name:"Real product",permalink:"https://store.example/product",images:[{src:"https://cdn.example/original.jpg"}],manage_stock:false},c,"2026-01-01T00:00:00Z","https://store.example");
 assert.equal(woo.inventoryQuantity,null);assert.equal(woo.images[0],"https://cdn.example/original.jpg");
 const wix=catalog.nativeProduct("wix",{id:"product",name:"Real",productPageUrl:{base:"https://store.example",path:"/product"},media:{items:[{image:{url:"https://static.wixstatic.com/media/source.jpg/v1/fit/w_50,h_50/file.jpg"}}]}},c,"2026-01-01T00:00:00Z","https://store.example");
 assert.equal(wix.images[0],"https://static.wixstatic.com/media/source.jpg");
});
