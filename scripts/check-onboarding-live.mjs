import assert from "node:assert/strict";
import {setTimeout as pause} from "node:timers/promises";
const sha=process.env.GITHUB_SHA;
let ready=false;
for(let i=0;i<80;i++){
 const response=await fetch("https://api.github.com/repos/"+process.env.GITHUB_REPOSITORY+"/commits/"+sha+"/status",{headers:{Authorization:"Bearer "+process.env.GH_TOKEN,Accept:"application/vnd.github+json"}});
 if(!response.ok)throw new Error("Could not read deployment status: "+response.status);
 const result=await response.json(),vercel=result.statuses.find(x=>x.context==="Vercel");
 if(vercel?.state==="success"){ready=true;break;}
 if(vercel?.state==="failure"||vercel?.state==="error")throw new Error("Production deployment failed");
 await pause(3000);
}
assert.ok(ready,"Exact production commit is deployed");
const headers={"User-Agent":"Gooidy-onboarding-check","Accept-Language":"en"};
const start=await fetch("https://gooidy.com/start",{headers});
assert.equal(start.status,200);assert.ok((await start.text()).includes("Your first ads"));
const next="/dashboard/setup?"+new URLSearchParams({url:"https://softmila.com/products/modest-wrap-cardigan",kind:"video"});
const login=await fetch("https://gooidy.com/login?"+new URLSearchParams({next}),{headers});
assert.equal(login.status,200);const html=await login.text();assert.ok(html.includes("Create your free account"));assert.ok(html.includes("softmila.com"));
const callback=await fetch("https://gooidy.com/auth/callback?"+new URLSearchParams({next}),{headers,redirect:"manual"});
assert.ok([302,303,307,308].includes(callback.status));const location=new URL(callback.headers.get("location"));assert.equal(location.searchParams.get("next"),next);
const preview=await fetch("https://gooidy.com/api/onboarding/preview",{method:"POST",headers:{...headers,Origin:"https://gooidy.com","Content-Type":"application/json"},body:JSON.stringify({url:"https://softmila.com/products/modest-wrap-cardigan"}),signal:AbortSignal.timeout(55000)});
assert.ok([200,422,429].includes(preview.status));
if(preview.ok){const data=await preview.json();assert.ok(data.title);console.log("LIVE_SETUP_PREVIEW",JSON.stringify({title:data.title,thumbnail:!!data.photo}));}
else console.log("LIVE_SETUP_PREVIEW",preview.status,"graceful fallback");
console.log("PASS production start, account context and expired-link handoff",sha);
