import test from "node:test";
import assert from "node:assert/strict";
import {planFeatureGroups,PRICING_QUESTIONS,pricingStructuredData,pricingStructuredJson} from "../src/lib/pricing-catalog.ts";
const plans=[{id:"free",price:0,credits:100,accounts:1},{id:"starter",price:29,credits:300,accounts:3},{id:"growth",price:79,credits:1000,accounts:10}];
test("feature lists preserve common tools while describing actual upgrade entitlements",()=>{
 const rows=(id:string)=>Object.fromEntries(planFeatureGroups(plans.find(p=>p.id===id)!).flatMap(g=>g.features.map(([label,value])=>[label,value] as [string,string])));
 const free=rows("free"),starter=rows("starter"),growth=rows("growth");
 assert.match(free["Weekly planning preview"],/Not included/);assert.match(starter["Weekly planning preview"],/Included/);assert.match(starter["Download a results CSV"],/Not included/);assert.match(growth["Download a results CSV"],/Included/);
 assert.equal(free["Recent published posts in results"],"Up to 8");assert.equal(growth["Recent published posts in results"],"Up to 30");
 for(const p of plans){const groups=planFeatureGroups(p);const labels=groups.flatMap(g=>g.features.map(([label])=>label));assert.equal(labels.length,29);assert.equal(new Set(labels).size,29);assert.match(rows(p.id)["Image headline and button edits"],/no generation credits/);assert.match(rows(p.id)["Posting queue and opt-in autopilot"],/Included/);}
});
test("structured FAQ matches visible content and does not publish purchasable offers",()=>{
 const data=pricingStructuredData(plans);const faq=data["@graph"].find(x=>x["@type"]==="FAQPage") as {mainEntity:{name:string;acceptedAnswer:{text:string}}[]};
 assert.deepEqual(faq.mainEntity.map(q=>[q.name,q.acceptedAnswer.text]),PRICING_QUESTIONS);
 const text=JSON.stringify(data);assert.ok(!text.includes('"offers"'));assert.ok(!text.includes('"aggregateRating"'));assert.ok(!text.includes('"price":29'));assert.equal(JSON.parse(pricingStructuredJson(plans))["@graph"].length,3);
});
test("JSON-LD cannot end its containing script when future content includes HTML",()=>{const hostile=[{...plans[0],id:'</script><script>alert("x")</script>'}];const encoded=pricingStructuredJson(hostile);assert.ok(!encoded.includes("<"));assert.deepEqual(JSON.parse(encoded),pricingStructuredData(hostile));});
