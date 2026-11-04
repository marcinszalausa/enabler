import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createRequire} from "node:module";
import {setTimeout as pause} from "node:timers/promises";
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
let browser,server,log="";
try{
 server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","-p","3118"],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture"},detached:true,stdio:["ignore","pipe","pipe"]});
 const capture=b=>{log=(log+b).slice(-14000);};server.stdout.on("data",capture);server.stderr.on("data",capture);
 let ready=false;for(let i=0;i<90;i++){try{if((await fetch("http://localhost:3118/pricing",{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await pause(1000);}assert.ok(ready,"Pricing route ready");
 browser=await chromium.launch({headless:true});
 for(const [width,locale,theme] of [[320,"en","light"],[390,"en","dark"],[390,"ar","light"],[1040,"de","light"],[1440,"en","light"]]){
  const page=await browser.newPage({viewport:{width,height:950},reducedMotion:"reduce"});const errors=[];let posts=0;
  page.on("pageerror",e=>errors.push(e.message));page.on("request",r=>{if(r.method()==="POST"&&!/^\/(_next|__nextjs)/.test(new URL(r.url()).pathname))posts++;});
  const base="http://localhost:3118"+(locale==="en"?"":"/"+locale);
  await page.goto(base+"/pricing",{waitUntil:"networkidle",timeout:90000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  assert.equal(await page.locator("[data-plan]").count(),3);assert.match(await page.locator('[data-plan="starter"]').innerText(),/\$29/);assert.match(await page.locator('[data-plan="growth"]').innerText(),/\$79/);
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"),"https://gooidy.com/pricing");
  const calculator=page.locator("[data-credit-calculator]");
  await calculator.getByLabel("Quality",{exact:true}).selectOption("best");await calculator.getByLabel("Images in a batch").selectOption("3");
  await page.waitForFunction(()=>document.querySelector("[data-batch-price]")?.textContent.includes("30 credits"));assert.match(await calculator.locator('[data-credit-capacity="free"]').innerText(),/18 images/);
  await calculator.getByLabel("Ad type").selectOption("video");await calculator.getByLabel("Length per video").selectOption("30");await page.waitForFunction(()=>document.querySelector("[data-batch-price]")?.textContent.includes("1080 credits"));assert.match(await calculator.locator('[data-credit-capacity="growth"]').innerText(),/0 videos/);
  await calculator.getByLabel("Quality",{exact:true}).selectOption("good");await calculator.getByLabel("Length per video").selectOption("7");await page.waitForFunction(()=>document.querySelector("[data-batch-price]")?.textContent.includes("60 credits"));assert.match(await calculator.locator('[data-credit-capacity="free"]').innerText(),/2 videos/);
  await page.evaluate(()=>scrollTo(0,0));
  if(width<1024){
   const menu=page.locator("details.mobile-nav"),summary=menu.locator("summary");
   await summary.click();const panel=menu.locator("dialog[open]");await panel.waitFor();assert.ok(await panel.evaluate(el=>el.matches(":modal")),"Native modal isolates the background");
   await page.waitForFunction(()=>document.body.style.overflow==="hidden");const box=await panel.boundingBox();assert.ok(box.width>=width-2&&box.height>=948,"Full-screen mobile menu");
   await page.keyboard.press("Shift+Tab");assert.ok(await panel.evaluate(el=>el.contains(document.activeElement)),"Focus remains inside the menu");
   if(width===390&&locale==="en")console.log("PUBLIC_MENU_PREVIEW",(await page.screenshot({type:"jpeg",quality:70})).toString("base64"));
   await page.keyboard.press("Escape");await page.waitForFunction(()=>!document.querySelector("details.mobile-nav")?.hasAttribute("open"));assert.equal(await summary.evaluate(el=>document.activeElement===el),true);
   await page.waitForFunction(()=>document.body.style.overflow!=="hidden");
   await summary.click();await menu.locator('dialog[open] a[href$="/features/image-ads"]').click();await page.waitForURL(url=>url.pathname.endsWith("/features/image-ads"));assert.equal(await page.locator("dialog[open]").count(),0);await page.waitForFunction(()=>document.body.style.overflow!=="hidden");
  }else{
   const menu=page.locator("[data-feature-menu]");await menu.locator("summary").click();assert.equal(await menu.locator('a[href$="/features/video-ads"]').isVisible(),true);await menu.locator('a[href$="/features/image-ads"]').click();await page.waitForURL(url=>url.pathname.endsWith("/features/image-ads"));
  }
  assert.equal(await page.locator("h1").innerText(),"Product photos into ready-to-use ads");
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"No feature-page overflow");
  for(const path of ["/features","/features/video-ads","/features/social-publishing","/features/campaigns","/features/brand-kit","/features/results","/features/for-your-business","/resources","/about"]){const response=await page.goto(base+path,{waitUntil:"networkidle",timeout:90000});assert.equal(response.status(),200,path);assert.equal(await page.locator("h1").count(),1);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"No overflow "+width+" "+path);}
  await page.goto(base+"/pricing",{waitUntil:"networkidle"});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"No pricing overflow");
  if(width===390&&locale==="en"){await page.locator("[data-public-plans]").scrollIntoViewIfNeeded();console.log("PUBLIC_PRICING_PREVIEW",(await page.screenshot({type:"jpeg",quality:70})).toString("base64"));}
  assert.equal(posts,0,"Information pages never generate, publish or start checkout");assert.deepEqual(errors,[]);
  console.log("PASS feature routes, truthful plan prices, credit calculations, modal focus/dismissal and responsive layout",width,locale,theme);await page.close();
 }
 const invalid=await fetch("http://localhost:3118/features/not-a-real-feature");assert.equal(invalid.status,404);
 const sitemap=await (await fetch("http://localhost:3118/sitemap.xml")).text();for(const path of ["/pricing","/features/image-ads","/resources","/about"])assert.ok(sitemap.includes("https://gooidy.com"+path));
 console.log("PASS unknown-feature 404 and public page sitemap");
}catch(error){console.error(log);throw error;}
finally{if(browser)await browser.close();if(server){try{process.kill(-server.pid,"SIGTERM");}catch{}}}
