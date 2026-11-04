import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createRequire} from "node:module";
import {setTimeout as pause} from "node:timers/promises";
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
let browser,server,log="";
try{
 server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","-p","3126"],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture"},detached:true,stdio:["ignore","pipe","pipe"]});
 const capture=b=>{log=(log+b).slice(-14000);};server.stdout.on("data",capture);server.stderr.on("data",capture);
 let ready=false;for(let i=0;i<90;i++){try{if((await fetch("http://localhost:3126/pricing",{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await pause(1000);}assert.ok(ready);
 const raw=await(await fetch("http://localhost:3126/pricing")).text();for(const phrase of ["Every plan, feature by feature","Weekly planning preview","Matching-network post comparisons","Why choose Growth instead of Starter?"])assert.ok(raw.includes(phrase),"Server HTML contains "+phrase);
 const match=raw.match(/<script\b[^>]*data-pricing-structured[^>]*>([\s\S]*?)<\/script>/);assert.ok(match,"JSON-LD is server-rendered");const data=JSON.parse(match[1]);assert.equal(data["@graph"].find(n=>n["@type"]==="ItemList").itemListElement.length,3);assert.ok(!JSON.stringify(data).includes('"offers"'));
 browser=await chromium.launch({headless:true});
 const plain=await browser.newPage({javaScriptEnabled:false});await plain.goto("http://localhost:3126/pricing",{waitUntil:"domcontentloaded"});assert.equal(await plain.locator("[data-plan-details] dt").count(),84,"All feature entries exist without JavaScript");assert.equal(await plain.locator("[data-pricing-faq] details").count(),9);await plain.close();
 for(const [width,locale]of [[320,"en"],[390,"en"],[390,"ar"],[1440,"en"]]){
  const page=await browser.newPage({viewport:{width,height:950},reducedMotion:"reduce"});const errors=[];page.on("pageerror",e=>errors.push(e.message));await page.goto("http://localhost:3126"+(locale==="en"?"":"/"+locale)+"/pricing",{waitUntil:"networkidle"});
  assert.equal(await page.locator("[data-plan]").count(),3);assert.equal(await page.locator("[data-plan-details]").count(),3);for(const p of ["free","starter","growth"])assert.equal(await page.locator(`[data-plan-details="${p}"] dt`).count(),28);
  assert.match(await page.locator('[data-plan-details="free"]').innerText(),/Not included — Starter and Growth/);assert.match(await page.locator('[data-plan-details="growth"]').innerText(),/Up to 30/);
  const questions=await page.locator("[data-pricing-faq] summary").allTextContents();const answers=await page.locator("[data-pricing-faq] details p").allTextContents();const faq=JSON.parse(await page.locator("script[data-pricing-structured]").textContent())["@graph"].find(n=>n["@type"]==="FAQPage");assert.deepEqual(faq.mainEntity.map(q=>q.name),questions);assert.deepEqual(faq.mainEntity.map(q=>q.acceptedAnswer.text),answers);
  await page.getByRole("navigation",{name:"Jump to full plan details"}).getByRole("link",{name:"growth details ↓"}).click();const box=await page.locator("#details-growth").boundingBox(),header=await page.locator("header").first().boundingBox();assert.ok(box.y>=header.y+header.height-1,"Jump clears sticky navigation");assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"No page overflow");
  if(width===390&&locale==="en")console.log("CATALOG_PREVIEW",(await page.screenshot({type:"jpeg",quality:70})).toString("base64"));assert.deepEqual(errors,[]);console.log("PASS full pricing lists, FAQ schema and responsive anchors",width,locale);await page.close();
 }
 console.log("PASS raw HTML content is readable without JavaScript");
}catch(error){console.error(log);throw error;}finally{await browser?.close();if(server?.pid)try{process.kill(-server.pid,"SIGTERM");}catch{}}
