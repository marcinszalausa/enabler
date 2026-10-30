// Compare the same public-media fixture before/after; no accounts or AI calls.
import assert from "node:assert/strict";
import { execFileSync,spawn } from "node:child_process";
import { mkdir,readFile,writeFile,rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { setTimeout as pause } from "node:timers/promises";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
const baseline=process.env.PERFORMANCE_BASELINE_SHA;
assert.match(baseline,/^[a-f0-9]{40}$/);
const changed=["src/app/_landing/phone-feed.tsx","src/app/_landing/angle-explorer.tsx"];
const originals=new Map(await Promise.all(changed.map(async path=>[path,await readFile(path,"utf8")])));
const route="src/app/[locale]/media-performance";
const names=["0","1","2","3","hidden","poster","angle0","angle1","angle2","angle3"];
const fixture=[
'import { PhoneFeed } from "@/app/_landing/phone-feed";',
'import { AngleExplorer } from "@/app/_landing/angle-explorer";',
'const photo=(id:string)=>"/reels/perf-"+id+".jpg";',
'const images=[0,1,2,3].map(i=>({productKey:String(i),image:photo(String(i)),alt:"Example "+i}));',
'const angles=[0,1,2,3].map(i=>({id:String(i),angle:"comfort",headline:"Angle "+i,primaryText:"Example",image:photo("angle"+i)}));',
'export default function MediaPerformance(){return <main className="p-4">',
'<h1>Media performance fixture</h1>',
'<div data-check="visible" className="w-[250px]"><PhoneFeed ads={images} sizes="250px" preload/></div>',
'<div data-check="hidden" style={{display:"none"}}><PhoneFeed ads={[{productKey:"hidden",image:photo("hidden")}]} sizes="250px"/></div>',
'<div style={{height:3200}}/>',
'<div data-check="video" className="w-[250px]"><PhoneFeed ads={[{productKey:"video",video:{src:"/reels/perf-clip.webm",poster:photo("poster")},sound:true}]} sizes="250px"/></div>',
'<div style={{height:1200}}/>',
'<div data-check="angles"><AngleExplorer store="example.com" ads={angles}/></div>',
'</main>}',
].join("\n");
let browser,server,serverLog="";
const stop=async()=>{
  if(server){
    const child=server;server=undefined;
    const exited=new Promise(resolve=>child.once("exit",resolve));
    try{process.kill(-child.pid,"SIGTERM");}catch{}
    await Promise.race([exited,pause(3000)]);await pause(300);
  }
};
try{
  await mkdir(route,{recursive:true});await writeFile(route+"/page.tsx",fixture);
  const jpeg=await readFile("public/reels/softmila-cardigan.jpg");
  for(const name of names)await writeFile("public/reels/perf-"+name+".jpg",jpeg);
  // Bundled test Chromium has no proprietary H.264 decoder. Use an offline
  // WebM sample to exercise playback lifecycle without changing production MP4s.
  execFileSync(require("ffmpeg-static"),["-i","public/reels/softmila-cardigan.mp4","-t","2","-an","-c:v","libvpx-vp9","-threads","2","-b:v","200k","-y","public/reels/perf-clip.webm"],{stdio:"ignore",timeout:60000});
  browser=await chromium.launch({headless:true});
  const results={};
  for(const phase of ["before","after"]){
    for(const path of changed)await writeFile(path,phase==="before"?execFileSync("git",["show",baseline+":"+path],{encoding:"utf8"}):originals.get(path));
    const port=phase==="before"?3101:3102;
    server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","-p",String(port)],{
      env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture"},
      detached:true,stdio:["ignore","pipe","pipe"],
    });
    const capture=b=>{serverLog=(serverLog+b).slice(-16000);};
    server.stdout.on("data",capture);server.stderr.on("data",capture);
    const url="http://localhost:"+port+"/media-performance";
    let ready=false;
    for(let i=0;i<100;i++){
      try{if((await fetch(url,{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}
      await pause(1000);
    }
    assert.ok(ready,"Fixture server ready: "+phase);
    const page=await browser.newPage({viewport:{width:390,height:844},locale:"en-US"});
    const errors=[];page.on("pageerror",error=>errors.push(error.message));
    const session=await page.context().newCDPSession(page);
    await session.send("Network.enable");await session.send("Network.setCacheDisabled",{cacheDisabled:true});
    const requests=new Set(),ids=new Set();let bytes=0;
    session.on("Network.responseReceived",({requestId,response})=>{
      let source=response.url;
      try{const u=new URL(source);source=u.searchParams.get("url")??u.pathname;}catch{}
      if(source.startsWith("/reels/perf-")){requests.add(source);ids.add(requestId);}
    });
    session.on("Network.loadingFinished",event=>{if(ids.has(event.requestId))bytes+=event.encodedDataLength;});
    await page.goto(url,{waitUntil:"networkidle",timeout:90000});
    await page.addStyleTag({content:"html{scroll-behavior:auto!important}"});
    await pause(800);
    const initial={images:requests.size,bytes,hiddenImages:await page.locator('[data-check="hidden"] img').count(),offscreenVideos:await page.locator('[data-check="video"] video[src]').count()};
    if(phase==="after"){
      assert.equal(initial.hiddenImages,0,"Hidden phones mount no images");
      assert.equal(initial.offscreenVideos,0,"Offscreen video has no network source");
      assert.ok(initial.images<=3,"Only current/neighbor image window loads");
    }
    const angles=page.locator('[data-check="angles"]');await angles.scrollIntoViewIfNeeded();await pause(1000);
    const total={images:requests.size,bytes,angleNodes:await angles.locator("img").count()};
    results[phase]={initial,total};
    console.log("MEDIA_PHASE",phase,JSON.stringify(results[phase]));
    if(phase==="after"){
      assert.equal(total.angleNodes,1,"Only selected angle mounts an image");
      const tabs=angles.getByRole("tab");await tabs.nth(2).click();
      await angles.locator('img[alt="Angle 2"]').waitFor({state:"visible"});
      const video=page.locator('[data-check="video"]');await video.scrollIntoViewIfNeeded();
      await video.locator("video").waitFor({state:"visible",timeout:15000});
      try {
        await page.waitForFunction(()=>{const v=document.querySelector('[data-check="video"] video');return v&&!v.paused&&v.readyState>=2;});
      } catch(error) {
        console.log("VIDEO_DIAGNOSTIC",await video.locator("video").evaluate(v=>({
          paused:v.paused,readyState:v.readyState,networkState:v.networkState,muted:v.muted,
          error:v.error?.message,errorCode:v.error?.code,source:v.currentSrc,
          mp4:v.canPlayType('video/mp4; codecs="avc1.42E01E"'),visibility:document.visibilityState,
        })));
        throw error;
      }
      await page.evaluate(()=>{Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>"hidden"});document.dispatchEvent(new Event("visibilitychange"));});
      await video.locator("video").waitFor({state:"detached"});
      await page.evaluate(()=>{Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>"visible"});document.dispatchEvent(new Event("visibilitychange"));});
      await video.locator("video").waitFor({state:"visible"});
      await page.locator("h1").scrollIntoViewIfNeeded();
      await video.locator("video").waitFor({state:"detached"});
      console.log("PASS offscreen/hidden-tab video cleanup and angle selection");
    }
    assert.deepEqual(errors,[],"No client errors");await page.close();await stop();
  }
  assert.ok(results.after.initial.images<results.before.initial.images,"Initial media requests decrease");
  assert.ok(results.after.total.images<results.before.total.images,"Unused angle downloads decrease");
  console.log("MEDIA_COMPARISON",JSON.stringify(results));
  await writeFile("/tmp/media-comparison.json",JSON.stringify(results,null,2));
  // Reopen the optimized fixture to verify user preferences and explicit play.
  for(const preference of ["reduce","saveData"]){
    const port=3103;
    server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","-p",String(port)],{
      env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture"},
      detached:true,stdio:["ignore","pipe","pipe"],
    });
    const capture=b=>{serverLog=(serverLog+b).slice(-16000);};
    server.stdout.on("data",capture);server.stderr.on("data",capture);
    const url="http://localhost:"+port+"/media-performance";
    let ready=false;
    for(let i=0;i<100;i++){try{if((await fetch(url,{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await pause(1000);}
    assert.ok(ready);
    const page=await browser.newPage({viewport:{width:390,height:844},locale:"en-US",reducedMotion:preference==="reduce"?"reduce":"no-preference"});
    if(preference==="saveData")await page.addInitScript(()=>Object.defineProperty(navigator,"connection",{configurable:true,value:Object.assign(new EventTarget(),{saveData:true})}));
    await page.goto(url,{waitUntil:"networkidle",timeout:90000});
    const group=page.locator('[data-check="video"]');await group.scrollIntoViewIfNeeded();await pause(1000);
    assert.equal(await group.locator("video").count(),0,"No automatic video: "+preference);
    await group.locator("button").first().click();
    await group.locator("video").waitFor({state:"visible",timeout:15000});
    await page.waitForFunction(()=>{const v=document.querySelector('[data-check="video"] video');return v&&!v.paused;});
    console.log("PASS explicit playback with",preference);
    await page.close();await stop();
  }
}catch(error){console.error(serverLog);throw error;}
finally{
  await stop();if(browser)await browser.close();
  for(const [path,content] of originals)await writeFile(path,content);
  await rm(route,{recursive:true,force:true});
  for(const name of names)await rm("public/reels/perf-"+name+".jpg",{force:true});
  await rm("public/reels/perf-clip.webm",{force:true});
}
