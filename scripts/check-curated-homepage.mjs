import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
const server=spawn("node",["node_modules/next/dist/bin/next","dev","-p","3113"],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"example-public-key"}});
let output="";server.stdout.on("data",d=>output=(output+d).slice(-8000));server.stderr.on("data",d=>output=(output+d).slice(-8000));
let browser;
try{
 for(let n=0;n<120;n++){try{if((await fetch("http://localhost:3113/")).ok)break;}catch{}await new Promise(r=>setTimeout(r,1000));}
 browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||undefined});
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:width===390?3:1,reducedMotion:"reduce"});
  const page=await context.newPage(),errors=[],dynamic=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("request",r=>{if(/\/_next\/image|\/api\/creatives\//.test(r.url()))dynamic.push(r.url());});
  await page.goto("http://localhost:3113/",{waitUntil:"domcontentloaded",timeout:90000});
  const start=Date.now();
  await page.locator("img[data-home-snapshot]:visible").first().evaluate(i=>i.decode());
  console.log("CURATED_FIRST_IMAGE_MS",width,Date.now()-start);
  const hero=await page.locator(".studio-rail-track img").evaluateAll(imgs=>imgs.map(i=>({loading:i.loading,src:i.currentSrc})));
  assert.equal(hero.length,5);assert.ok(hero.slice(0,3).every(i=>i.loading!=="lazy"));
  const keys=await page.locator(".studio-rail-track [data-product-key]").evaluateAll(items=>items.map(i=>i.dataset.productKey));
  assert.equal(new Set(keys).size,keys.length,"Hero examples show different products");
  await page.addStyleTag({content:"html{scroll-behavior:auto!important}"});
  for(let y=0;y<await page.evaluate(()=>document.documentElement.scrollHeight);y+=650){await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(100);}
  await page.waitForFunction(()=>[...document.images].filter(i=>i.getBoundingClientRect().width>0).every(i=>i.complete&&i.naturalWidth>0),{},{timeout:30000});
  const snapshots=await page.locator("img[data-home-snapshot]").evaluateAll(imgs=>imgs.map(i=>({src:i.currentSrc,fit:getComputedStyle(i).objectFit})));
  assert.ok(snapshots.length>=8);assert.equal(await page.locator('#how img[data-home-snapshot]').count(),2);assert.equal(await page.locator('[data-store-workflow-preview] img[data-home-snapshot]').count(),1);assert.ok(snapshots.every(i=>i.fit==="contain"));
  assert.equal(await page.locator("[data-home-fallback]").count(),0);assert.deepEqual(dynamic,[]);assert.deepEqual(errors,[]);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  console.log("CURATED_BROWSER_VERIFIED",JSON.stringify({width,snapshots:snapshots.length,broken:0,databaseCredentials:false}));
  await context.close();
 }
 const offline=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:900}});
 await offline.route("**/showcase/**",r=>r.abort());
 const page=await offline.newPage();await page.goto("http://localhost:3113/",{waitUntil:"domcontentloaded"});
 const previews=await page.locator("img[data-home-snapshot]").evaluateAll(imgs=>imgs.map(i=>i.getAttribute("style")||""));
 assert.ok(previews.length>=3);assert.ok(previews.every(s=>s.includes("data:image/webp;base64")));
 console.log("CURATED_INLINE_PREVIEWS_VERIFIED",previews.length);
} catch(e){console.log(output);throw e;}
finally{await browser?.close();server.kill("SIGTERM");}
