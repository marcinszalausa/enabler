import {test} from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {canonicalProduct,catalogCsv,catalogWebhook} from "../src/lib/catalog/normalize.ts";
import {encryptCatalogSecret,decryptCatalogSecret,verifyCatalogWebhook,trainingAllowed,catalogBody} from "../src/lib/catalog/security.ts";
const c={id:"source",workspace_id:"workspace",platform:"custom",store_origin:"https://www.softmila.com",webhook_domain:"softmila.myshopify.com",enabled:true};
const product={externalId:"1",url:c.store_origin+"/products/test",name:"Cabin",images:["https://cdn.example.com/a.jpg"],inventoryQuantity:null,updatedAt:"2026-01-01T00:00:00Z"};
test("canonical source enforces origin, public HTTPS, quantities and safe identifiers",()=>{
 assert.equal(canonicalProduct(product,c).inventoryQuantity,null);
 for(const patch of [{url:"https://evil.example/product"},{images:["http://127.0.0.1/a"]},{inventoryQuantity:-1},{externalId:Number.MAX_SAFE_INTEGER+1},{updatedAt:"2099-01-01T00:00:00Z"}])assert.throws(()=>canonicalProduct({...product,...patch},c));
 assert.equal(canonicalProduct({...product,images:[...product.images,...product.images]},c).images.length,1);
});
test("CSV handles quoted names and fails malformed/duplicate rows",()=>{
 const header="external_id,url,name,images,inventory_quantity,updated_at\n";
 const row='1,https://www.softmila.com/products/test,"Cabin, cozy",https://cdn.example.com/a.jpg,,2026-01-01T00:00:00Z';
 assert.equal(catalogCsv(header+row,c)[0].name,"Cabin, cozy");
 assert.throws(()=>catalogCsv(header+row+"\n"+row,c));
 assert.throws(()=>catalogCsv(header+row+'"',c));
});
test("Shopify unknown inventory stays unknown and stock zero is explicit",()=>{
 const body={id:1,handle:"test",title:"Cabin",images:[{src:product.images[0]}],variants:[{inventory_management:null,inventory_quantity:0}],updated_at:product.updatedAt};
 assert.equal(catalogWebhook(body,{...c,platform:"shopify"},"products/update")[0].inventoryQuantity,null);
 assert.equal(catalogWebhook({...body,variants:[{inventory_management:"shopify",inventory_quantity:0}]},{...c,platform:"shopify"},"products/update")[0].inventoryQuantity,0);
});
test("HMAC verifies exact bytes and rejects replay, tampering and wrong Shopify shop",()=>{
 const bytes=Buffer.from('{"products":[]}'),secret="test-secret",timestamp="1794000000";
 const sig=createHmac("sha256",secret).update(timestamp+".").update(bytes).digest("hex");
 const h=new Headers({"x-gooidy-signature":"t="+timestamp+",v1="+sig});
 assert.equal(verifyCatalogWebhook(c,h,bytes,secret,1794000000000),true);
 assert.equal(verifyCatalogWebhook(c,h,bytes,secret,1794000400000),false);
 assert.equal(verifyCatalogWebhook(c,h,Buffer.from("{}"),secret,1794000000000),false);
 const shop={...c,platform:"shopify"},sh=new Headers({"x-shopify-shop-domain":c.webhook_domain,"x-shopify-hmac-sha256":createHmac("sha256",secret).update(bytes).digest("base64")});
 assert.equal(verifyCatalogWebhook(shop,sh,bytes,secret),true);sh.set("x-shopify-shop-domain","another.myshopify.com");assert.equal(verifyCatalogWebhook(shop,sh,bytes,secret),false);
});
test("secrets authenticated encryption and preview training refusal",()=>{
 process.env.CATALOG_ENCRYPTION_KEY="ab".repeat(32);
 const encrypted=encryptCatalogSecret("private webhook secret");
 assert.equal(decryptCatalogSecret(encrypted),"private webhook secret");
 const parts=encrypted.split(".");parts[2]=Buffer.alloc(16).toString("base64");assert.throws(()=>decryptCatalogSecret(parts.join(".")));
 process.env.VERCEL_ENV="preview";assert.equal(trainingAllowed(c.workspace_id,product.url),false);
});
test("body limit rejects oversized streaming payload",async()=>{
 await assert.rejects(catalogBody(new Request("https://gooidy.com",{method:"POST",body:"12345"}),4),/TOO_LARGE/);
});
