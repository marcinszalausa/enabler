import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {setTimeout as pause} from "node:timers/promises";
let ready=false;
for(let n=0;n<36;n++){
 const status=JSON.parse(execFileSync("gh",["api","repos/marcinszalausa/enabler/commits/"+process.env.GITHUB_SHA+"/status"],{encoding:"utf8"}));
 const state=status.statuses.find(x=>x.context==="Vercel")?.state;
 if(state==="success"){ready=true;break;}if(state==="failure"||state==="error")throw Error("Deployment failed");
 await pause(10000);
}
assert.ok(ready,"Deployment ready");
const paths=["/policies","/terms","/privacy","/policies/billing","/policies/cookies","/policies/acceptable-use","/policies/privacy-requests"];
for(const path of paths){
 const r=await fetch("https://gooidy.com"+path,{headers:{"user-agent":"GooidyLegalVerificationBot/1.0"}});assert.equal(r.status,200,path);
 const html=await r.text();assert.ok(html.includes("2026-11-04-r4"),path);assert.ok(!html.includes("data-prelaunch-legal"),path);assert.ok(html.includes("data-policy-version"),path);assert.ok(!html.includes("Zeely, Inc."),path);
}
const r=await fetch("https://gooidy.com/api/billing/checkout",{method:"POST",headers:{"content-type":"application/json"},body:"{}"});
assert.equal(r.status,503);assert.equal((await r.json()).code,"CHECKOUT_NOT_AVAILABLE");assert.equal(r.headers.get("location"),null);
console.log("LIVE_LEGAL_VERIFIED",JSON.stringify({pages:paths.length,checkout:503,version:"2026-11-04-r4"}));
