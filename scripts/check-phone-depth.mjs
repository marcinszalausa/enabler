import assert from "node:assert/strict";
import { mkdir,writeFile,rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { setTimeout as pause } from "node:timers/promises";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
const folder="src/app/[locale]/phone-depth-preview";
const fixture=[
'import { HeroStage } from "@/app/_landing/hero-stage";',
'const first={productKey:"fixture-a",image:"/reels/softmila-cardigan.jpg",alt:"First example"};',
'const second={productKey:"fixture-b",image:"/reels/softmila-still.jpg",alt:"Second example"};',
'const third={productKey:"fixture-c",image:"/reels/softmila-cardigan.jpg",alt:"Third example"};',
'export default function PhoneDepthPreview(){return <main className="landing mx-auto w-full max-w-6xl px-4">',
'<div data-phone-scene className="py-20"><HeroStage feed={[first]} left={second} right={third}/></div>',
'</main>}',
].join("\n");
let server,browser,log="";
try{
 await mkdir(folder,{recursive:true});await writeFile(folder+"/page.tsx",fixture);
 server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","-p","3100"],{
  env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture"},
  detached:true,stdio:["ignore","pipe","pipe"],
 });
 const capture=chunk=>{log=(log+chunk).slice(-14000);};server.stdout.on("data",capture);server.stderr.on("data",capture);
 let ready=false;
 for(let i=0;i<100;i++){try{if((await fetch("http://localhost:3100/phone-depth-preview",{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await pause(1000);}
 assert.ok(ready,"Phone scene became ready");
 browser=await chromium.launch({headless:true});
 for(const [width,theme,motion] of [[980,"light","reduce"],[1440,"dark","reduce"],[390,"light","reduce"],[1440,"light","no-preference"]]){
  const page=await browser.newPage({viewport:{width,height:1000},locale:"en-US",reducedMotion:motion});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("http://localhost:3100/phone-depth-preview",{waitUntil:"networkidle",timeout:90000});
  await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
  await page.addStyleTag({content:".stage,.stage-side{animation:none!important}.stage-inner{transition:none!important}"});
  await page.locator("[data-phone-scene]").scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>[...document.querySelectorAll("[data-phone-scene] img")].every(i=>i.complete&&i.naturalWidth>0));
  await pause(300);
  const geometry=await page.locator(".stage-side").evaluateAll(nodes=>nodes.map(el=>{
   const frame=el.querySelector(".iphone-frame").getBoundingClientRect();
   const back=el.querySelector(".iphone-back").getBoundingClientRect();
   const rail=el.querySelector(el.classList.contains("stage-left")?".iphone-rail-right":".iphone-rail-left").getBoundingClientRect();
   return{
    displayed:getComputedStyle(el).display!=="none",
    depthOffset:Math.abs(frame.x-back.x)+Math.abs(frame.width-back.width),
    railWidth:rail.width,
    wrappers:[el,el.querySelector(".stage-phone"),el.querySelector(".iphone-space"),el.querySelector(".iphone-3d")].map(n=>getComputedStyle(n).transformStyle),
    filterCount:[...el.querySelectorAll(".iphone-slab")].filter(n=>getComputedStyle(n).filter!=="none").length,
    slabs:el.querySelectorAll(".iphone-slab").length,
   };
  }));
  console.log("PHONE_GEOMETRY",JSON.stringify({width,theme,motion,geometry}));
  if((width===980&&theme==="light")||(width===1440&&theme==="dark")){
   const name=theme+"-"+width;
   const buffer=await page.locator("[data-phone-scene]").screenshot({type:"jpeg",quality:82,animations:"disabled"});
   const data=buffer.toString("base64");
   for(let i=0;i<data.length;i+=4000)console.log("PHONE_IMAGE",name,i/4000,data.slice(i,i+4000));
   console.log("PHONE_IMAGE_END",name,data.length);
  }
  for(const side of geometry){
   if(width<640){assert.equal(side.displayed,false);continue;}
   assert.ok(side.displayed);
   assert.ok(side.depthOffset>3,"Chassis remains genuinely 3D after parent rotation");
   assert.ok(side.railWidth>4,"Continuous metal edge has visible projected width");
   assert.ok(side.wrappers.every(v=>v==="preserve-3d"),"No intermediate flat wrapper");
   assert.equal(side.filterCount,0,"No per-slice GPU filters");
   assert.ok(side.slabs<=12,"Body layer count stays bounded");
  }
  assert.deepEqual(errors,[]);
  console.log("PASS physical phone body",width,theme,motion);
  await page.close();
 }
}catch(error){console.error(log);throw error;}
finally{
 if(browser)await browser.close();
 if(server){try{process.kill(-server.pid,"SIGTERM");}catch{}}
 await rm(folder,{recursive:true,force:true});
}
