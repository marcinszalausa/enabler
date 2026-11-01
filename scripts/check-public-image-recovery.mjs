import assert from "node:assert/strict";
import {mkdir,writeFile,readFile,rm} from "node:fs/promises";
import {spawn} from "node:child_process";
import {createRequire} from "node:module";
import {setTimeout as pause} from "node:timers/promises";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
const directory="src/app/[locale]/image-recovery-fixture";
const ids=["11111111","22222222","33333333","44444444"];
let browser,server,log="";
try{
 await mkdir(directory,{recursive:true});
 await writeFile(directory+"/page.tsx",'"use client";\nimport Image from "@/app/_landing/ad-image";\nimport {useState} from "react";\nexport default function Fixture(){const [switched,setSwitched]=useState(false);return <main>{["11111111","22222222","33333333","44444444"].map((id,i)=><Image key={id} data-case={i} src={`/api/creatives/${switched&&i===1?"55555555":id}-1111-4111-8111-111111111111/image?layout=face-aware-v2`} alt={"Fixture "+i} width={1080} height={1920} sizes="200px" style={{width:200,height:"auto"}}/>)}<button onClick={()=>setSwitched(true)}>Change image</button></main>}');
 const jpeg=await readFile("public/reels/softmila-cardigan.jpg");
 server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","-p","3107"],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture"},stdio:["ignore","pipe","pipe"],detached:true});
 const capture=b=>{log=(log+b).slice(-16000);};server.stdout.on("data",capture);server.stderr.on("data",capture);
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch("http://localhost:3107/image-recovery-fixture",{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await pause(1000);}
 assert.ok(ready,"Fixture ready");
 browser=await chromium.launch({headless:true});
 for(const deviceScaleFactor of [1,3]){
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor});
  const requests=[];const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/_next/image?**",async route=>{
   const u=new URL(route.request().url()),source=u.searchParams.get("url");
   requests.push({source,optimized:true});
   assert.ok(source.endsWith("?layout=face-aware-v2&preview=1"),"Optimizer fetches bounded preview");
   if(source.includes(ids[0])||source.includes("55555555"))await route.fulfill({status:200,contentType:"image/jpeg",body:jpeg});
   else await route.fulfill({status:503,body:"Temporary optimizer failure"});
  });
  await page.route("**/api/creatives/*/image?**",async route=>{
   const source=route.request().url();requests.push({source,optimized:false});
   if(source.includes(ids[3])||(source.includes(ids[2])&&source.endsWith("retry=1")))await route.abort("failed");
   else await route.fulfill({status:200,contentType:"image/jpeg",body:jpeg});
  });
  await page.goto("http://localhost:3107/image-recovery-fixture",{waitUntil:"networkidle",timeout:90000});
  for(let i=0;i<3;i++){
   const image=page.locator('img[data-case="'+i+'"]');await image.scrollIntoViewIfNeeded();
   await page.waitForFunction(i=>{const image=document.querySelector('img[data-case="'+i+'"]');return image.complete&&image.naturalWidth>0;},i);
  }
  await page.locator('img[data-case="3"]').scrollIntoViewIfNeeded();await pause(1000);
  assert.equal(requests.filter(r=>r.source.includes(ids[0])).length,1,"Successful optimized image requests no fallback");
  assert.equal(requests.filter(r=>r.source.includes(ids[1])).length,2,"Optimizer failure recovers directly");
  assert.equal(requests.filter(r=>r.source.includes(ids[2])).length,3,"Network interruption gets one further retry");
  assert.equal(requests.filter(r=>r.source.includes(ids[3])).length,3,"Persistent failures cannot loop");
  await page.getByRole("button",{name:"Change image"}).click();
  await page.waitForFunction(()=>{const i=document.querySelector('img[data-case="1"]');return i.complete&&i.naturalWidth>0&&i.currentSrc.includes("55555555");});
  assert.ok(requests.find(r=>r.source.includes("55555555")&&r.optimized),"Changing creative resets recovery");
  assert.deepEqual(errors,[]);
  console.log("PASS optimized success, failed optimizer, network retry, bounded failure and changed source; DPR",deviceScaleFactor);
  await page.close();
 }
}catch(error){console.error(log);throw error;}
finally{if(browser)await browser.close();if(server){try{process.kill(-server.pid,"SIGTERM");}catch{}}await rm(directory,{recursive:true,force:true});}
