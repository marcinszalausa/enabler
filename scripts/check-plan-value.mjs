import assert from "node:assert/strict";
import {mkdir,writeFile,rm,readFile} from "node:fs/promises";
import {spawn} from "node:child_process";
import {createRequire} from "node:module";
import {setTimeout as pause} from "node:timers/promises";
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
const folder="src/app/[locale]/plan-value-preview";
let browser,server,log="";
try{
 await mkdir(folder,{recursive:true});await writeFile(folder+"/page.tsx","import {Suspense} from \"react\";\nimport {WeekPlanner} from \"@/app/[locale]/dashboard/publishing/planner/week-planner\";\nimport {GrowthReport} from \"@/app/[locale]/dashboard/insights/growth-report\";\nimport {GrowthActionPlan} from \"@/app/[locale]/dashboard/insights/growth-action-plan\";\nconst rows=[{id:\"one\",network:\"Facebook\",caption:\"A genuine benefit\",date:\"2026-11-01\",state:\"ready\",impressions:1000,clicks:20,views:null},{id:\"two\",network:\"Facebook\",caption:\"=unsafe spreadsheet text\",date:\"2026-11-02\",state:\"ready\",impressions:500,clicks:15,views:null},{id:\"three\",network:\"Instagram\",caption:\"Instagram starting message\",date:\"2026-11-01\",state:\"ready\",impressions:1000,clicks:10,views:null},{id:\"four\",network:\"Instagram\",caption:\"Instagram second message\",date:\"2026-11-02\",state:\"ready\",impressions:1000,clicks:40,views:null}];\nexport default function Preview(){return <Suspense fallback={<p>Loading…</p>}><main className=\"landing mx-auto min-w-0 max-w-5xl p-4\"><h1>Plan tools preview</h1><WeekPlanner ads={[{id:\"91000000-0000-4000-8000-000000000001\",headline:\"A genuine benefit\",product:\"Your product\"}]}/><GrowthReport enabled rows={rows}/><GrowthActionPlan rows={rows}/><GrowthActionPlan rows={[]}/></main></Suspense>;}\n");
 server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","-p","3118"],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture"},detached:true,stdio:["ignore","pipe","pipe"]});
 const capture=b=>{log=(log+b).slice(-14000);};server.stdout.on("data",capture);server.stderr.on("data",capture);
 let ready=false;for(let i=0;i<90;i++){try{if((await fetch("http://localhost:3118/pricing",{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await pause(1000);}assert.ok(ready,"Pricing route ready");
 browser=await chromium.launch({headless:true});
 for(const [width,locale,theme] of [[320,"en","light"],[390,"en","dark"],[390,"ar","light"],[1040,"de","light"],[1440,"en","light"]]){
  const page=await browser.newPage({viewport:{width,height:950},reducedMotion:"reduce"});const errors=[];let posts=0;
  page.on("pageerror",e=>errors.push(e.message));page.on("request",r=>{if(r.method()==="POST"&&!/^\/(_next|__nextjs)/.test(new URL(r.url()).pathname))posts++;});
  const base="http://localhost:3118"+(locale==="en"?"":"/"+locale);
  await page.goto(base+"/pricing",{waitUntil:"networkidle",timeout:90000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  assert.equal(await page.locator("[data-plan]").count(),4);assert.equal(await page.locator('[data-plan="starter"] [data-price]').getAttribute("data-price"),"39");assert.equal(await page.locator('[data-plan="plus"] [data-recommended-plan]').count(),1);assert.equal(await page.locator('[data-plan="growth"] [data-price]').getAttribute("data-price"),"99");
  await page.locator("[data-billing-toggle] button").nth(1).click();await page.waitForFunction(()=>document.querySelector('[data-plan="growth"] [data-price]')?.getAttribute("data-price")==="79.2");await page.locator("[data-billing-toggle] button").nth(0).click();
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"),locale==="en"?"https://gooidy.com/pricing":"https://gooidy.com/"+locale+"/pricing");
  await page.evaluate(()=>scrollTo(0,0));
  if(width<1024){
   const menu=page.locator("details.mobile-nav"),summary=menu.locator("summary");
   await summary.click();const panel=menu.locator("dialog[open]");await panel.waitFor();assert.ok(await panel.evaluate(el=>el.matches(":modal")),"Native modal isolates the background");
   await page.waitForFunction(()=>document.body.style.overflow==="hidden");const box=await panel.boundingBox();assert.ok(box.width>=width-2&&box.height>=948,"Full-screen mobile menu");
   if(width===320||(width===390&&locale==="en"))console.log("PUBLIC_MENU_PREVIEW",(await page.screenshot({type:"jpeg",quality:70})).toString("base64"));
   for(let i=0;i<16;i++){await page.keyboard.press("Shift+Tab");assert.ok(await panel.evaluate(el=>el.contains(document.activeElement)),"Focus remains inside the menu");}

   await page.keyboard.press("Escape");await page.waitForFunction(()=>!document.querySelector("details.mobile-nav")?.hasAttribute("open"));assert.equal(await summary.evaluate(el=>document.activeElement===el),true);
   await page.waitForFunction(()=>document.body.style.overflow!=="hidden");
   await summary.click();await menu.locator('dialog[open] a[href$="/features/image-ads"]').click();await page.waitForURL(url=>url.pathname.endsWith("/features/image-ads"));assert.equal(await page.locator("dialog[open]").count(),0);await page.waitForFunction(()=>document.body.style.overflow!=="hidden");
  }else{
   const menu=page.locator("[data-feature-menu]");await menu.locator("summary").click();assert.equal(await menu.locator('a[href$="/features/video-ads"]').isVisible(),true);await menu.locator('a[href$="/features/image-ads"]').click();await page.waitForURL(url=>url.pathname.endsWith("/features/image-ads"));
  }
  assert.equal(await page.locator("h1:visible").innerText(),"Product photos into ready-to-use ads");
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"No feature-page overflow");
  for(const path of ["/features","/features/video-ads","/features/social-publishing","/features/campaigns","/features/brand-kit","/features/results","/features/for-your-business","/resources","/about"]){const response=await page.goto(base+path,{waitUntil:"networkidle",timeout:90000});assert.equal(response.status(),200,path);assert.equal(await page.locator("h1:visible").count(),1);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"No overflow "+width+" "+path);}
  await page.goto(base+"/pricing#packs",{waitUntil:"networkidle"});const targetBox=await page.locator("#packs").boundingBox(),headerBox=await page.locator("header").first().boundingBox();assert.ok(targetBox.y>=headerBox.y+headerBox.height-1,"Packs anchor clears the sticky header");assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"No pricing overflow");
  if(width===390&&locale==="en"){await page.locator("[data-public-plans]").scrollIntoViewIfNeeded();console.log("PUBLIC_PRICING_PREVIEW",(await page.screenshot({type:"jpeg",quality:70})).toString("base64"));}
  assert.equal(posts,0,"Information pages never generate, publish or start checkout");assert.deepEqual(errors,[]);
  console.log("PASS feature routes, truthful plan prices, plan toggle, modal focus/dismissal and responsive layout",width,locale,theme);await page.close();
 }
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:950}});await page.goto("http://localhost:3118/plan-value-preview",{waitUntil:"networkidle"});await page.getByLabel("Post 1",{exact:true}).selectOption("91000000-0000-4000-8000-000000000001");
  const download=page.waitForEvent("download");await page.getByRole("button",{name:"Download results CSV"}).click();const file=await download;assert.equal(file.suggestedFilename(),"gooidy-post-results.csv");const csv=await readFile(await file.path(),"utf8");assert.ok(csv.includes("'=unsafe spreadsheet text"));await page.getByLabel("Social network",{exact:true}).selectOption("Instagram");const report=page.locator("[data-growth-report]");assert.ok(!(await report.innerText()).includes("A genuine benefit"));assert.match(await report.innerText(),/Instagram second message/);const filteredDownload=page.waitForEvent("download");await report.getByRole("button",{name:"Download results CSV"}).click();const filtered=await filteredDownload;const filteredCsv=await readFile(await filtered.path(),"utf8");assert.match(filteredCsv,/Instagram starting message/);assert.ok(!filteredCsv.includes("unsafe spreadsheet"));
  const plan=page.locator("[data-growth-action-plan]").first();assert.equal(await plan.locator("ol > li").count(),2);const empty=page.locator("[data-growth-action-plan]").nth(1);assert.equal(await empty.getByRole("button").count(),0);assert.match(await empty.innerText(),/we do not invent a recommendation/);
  const briefDownload=page.waitForEvent("download");await page.getByRole("button",{name:"Download next-campaign brief"}).click();const brief=await briefDownload;assert.equal(brief.suggestedFilename(),"gooidy-growth-testing-plan.txt");const text=await readFile(await brief.path(),"utf8");assert.match(text,/NEXT-CAMPAIGN TESTING BRIEF/);assert.match(text,/Facebook/);assert.match(text,/Instagram/);assert.ok(text.includes("not controlled A/B tests"));assert.match(text,/credit price shown before generation/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"Paid tools fit mobile");console.log("PASS planner controls and Growth report download",width);await page.close();
 }
 const invalid=await fetch("http://localhost:3118/features/not-a-real-feature");assert.equal(invalid.status,404);
 const sitemap=await (await fetch("http://localhost:3118/sitemap.xml")).text();for(const path of ["/pricing","/features/image-ads","/resources","/about"])assert.ok(sitemap.includes("https://gooidy.com"+path));
 console.log("PASS unknown-feature 404 and public page sitemap");
}catch(error){console.error(log);throw error;}
finally{await rm(folder,{recursive:true,force:true});if(browser)await browser.close();if(server){try{process.kill(-server.pid,"SIGTERM");}catch{}}}
