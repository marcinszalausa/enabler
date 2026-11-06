import {test} from "node:test";
import assert from "node:assert/strict";
import {websiteOrigin,sameStoreUrl,sitemapLinks,catalogCandidates,robotsRules,robotsAllow,websiteProduct} from "../src/lib/catalog/website.ts";
const origin="https://shop.example",connection={id:"source",workspace_id:"workspace",platform:"custom",store_origin:origin,webhook_domain:"shop.example",enabled:true};
test("store addresses cannot target private networks or attach credentials",()=>{
 assert.equal(websiteOrigin("shop.example/products/example"),origin);
 for(const value of ["http://shop.example","https://127.0.0.1","https://169.254.169.254","https://user:pass@shop.example","https://[::1]"])assert.throws(()=>websiteOrigin(value));
 assert.equal(sameStoreUrl("https://another.example/product",origin),null);
 assert.equal(sameStoreUrl("/product/one",origin),origin+"/product/one");
});
test("sitemaps support WooCommerce, Wix, Squarespace and ordinary product paths without cross-site crawling",()=>{
 const links=sitemapLinks("<urlset><url><loc>https://shop.example/product/one</loc></url><url><loc><![CDATA[https://shop.example/product-page/two]]></loc></url><url><loc>https://shop.example/shop/p/three</loc></url><url><loc>https://evil.example/product</loc></url></urlset>",origin);
 assert.equal(links.length,3);
 const candidates=catalogCandidates([...links,origin+"/checkout",origin+"/privacy",origin+"/blog/post",origin+"/plain-product/"],origin);
 assert.equal(candidates.length,4);assert.equal(new Set(candidates).size,4);
 assert.equal(catalogCandidates(Array.from({length:150},(_,i)=>origin+"/product/"+i),origin).length,100);
});
test("robots rules honor site blocks and more specific allow rules",()=>{
 const rules=robotsRules("User-agent: *\nDisallow: /private/\nDisallow: /cart*\nAllow: /private/product");
 assert.equal(robotsAllow(origin+"/private/order",rules),false);
 assert.equal(robotsAllow(origin+"/private/product",rules),true);
 assert.equal(robotsAllow(origin+"/cart?add=1",rules),false);
 assert.equal(robotsAllow(origin+"/product/one",rules),true);
 assert.equal(robotsAllow(origin+"/product/one",robotsRules("User-agent: *\nDisallow: /")),false);
});
test("imports actual product data, never a homepage hero or arbitrary metadata",()=>{
 const observed="2026-01-01T00:00:00Z",url=origin+"/product/one";
 assert.equal(websiteProduct('<meta property="og:image" content="https://cdn.example/hero.jpg">',url,connection,observed),null);
 const html='<script type="application/ld+json">'+JSON.stringify({"@graph":[{"@type":"Organization",name:"Store"},{"@type":"Product",name:"Real product",image:["https://cdn.example/product.jpg"]}]})+"</script>";
 const product=websiteProduct(html,url,connection,observed);
 assert.equal(product?.name,"Real product");assert.equal(product?.inventoryQuantity,null);assert.equal(product?.images.length,1);
 assert.equal(product?.imageRevision.length,64);
 const unsafe='<script type="application/ld+json">'+JSON.stringify({"@type":"Product",name:"Bad",image:"http://127.0.0.1/admin"})+"</script>";
 assert.equal(websiteProduct(unsafe,url,connection,observed),null);
});
