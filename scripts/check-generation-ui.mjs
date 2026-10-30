import assert from "node:assert/strict";
import {mkdir,writeFile,readFile,rm} from "node:fs/promises";
import {spawn} from "node:child_process";
import {createRequire} from "node:module";
import {setTimeout as pause} from "node:timers/promises";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
const folder="src/app/[locale]/generation-ui-preview";
let server,browser,log="";
try {
 await mkdir(folder,{recursive:true});await writeFile(folder+"/page.tsx","import { GenerationBlock, type Generation } from \"@/app/[locale]/dashboard/products/[id]/generation-block\";\nimport { AutoRefresh } from \"@/app/[locale]/dashboard/products/[id]/auto-refresh\";\nimport { getMessages } from \"@/i18n/messages\";\nimport { isLocale } from \"@/i18n/config\";\nconst image=(i:number)=>({id:\"image-\"+i,kind:\"image\" as const,aspect:i%2?\"9:16\":\"1:1\",angle:\"benefit\",headline:\"Example ad\",primary_text:\"Example saved ad\",cta:\"Shop now\"});\nconst video={...image(1),id:\"video-1\",kind:\"video\" as const,aspect:\"9:16\"};\nconst base={id:\"batch\",type:\"video_ads\",status:\"running\" as const,error:null,created_at:\"2026-10-30T12:00:00Z\",showcased_at:null,cost_credits:40,creatives:[]};\nconst cases:{name:string;g:Generation;receipt:{charged_credits:number|null;returned_credits:number|null}|null}[]=[\n{name:\"queued\",g:{...base,status:\"queued\"},receipt:{charged_credits:40,returned_credits:null}},\n{name:\"preparing\",g:{...base,video_jobs:[{status:\"drafting\"},{status:\"pending\"}]},receipt:null},\n{name:\"creating\",g:{...base,type:\"image_ads\",cost_credits:10,creatives:[image(1),image(2),image(3)]},receipt:{charged_credits:10,returned_credits:null}},\n{name:\"finishing\",g:{...base,video_jobs:[{status:\"done\"},{status:\"processing\"}],creatives:[video]},receipt:null},\n{name:\"partial\",g:{...base,status:\"succeeded\",creatives:[video],error:\"Some videos could not be completed.\"},receipt:{charged_credits:40,returned_credits:20}},\n{name:\"failed\",g:{...base,type:\"image_ads\",status:\"failed\",cost_credits:10,error:\"Quality check failed\"},receipt:{charged_credits:10,returned_credits:10}},\n{name:\"legacy\",g:{...base,type:\"image_ads\",status:\"succeeded\",cost_credits:10,creatives:Array.from({length:6},(_,i)=>image(i))},receipt:null},\n{name:\"ready\",g:{...base,type:\"image_ads\",status:\"succeeded\",cost_credits:10,creatives:Array.from({length:10},(_,i)=>image(i))},receipt:{charged_credits:10,returned_credits:0}},\n];\nexport default async function Preview({params}:PageProps<\"/[locale]/generation-ui-preview\">){const {locale}=await params;if(!isLocale(locale))return null;const t=await getMessages(locale);return <main className=\"mx-auto max-w-5xl px-4 py-10\"><div id=\"generate-ads\" tabIndex={-1} className=\"rounded-xl border border-line p-4\">{t.run.retryHint}</div><div data-poller><AutoRefresh active videoRuns={[\"fixture-run\"]}/></div>{cases.map(({name,g,receipt})=><section data-case={name} key={name} className=\"mt-10\"><GenerationBlock t={t} locale={locale} generation={g} receipt={receipt} canRetry imageVersion=\"fixture\" canShowcase={false} productUrl=\"https://example.invalid\" accounts={null} nextSlot={null} posts={{}}/></section>)}</main>}");
 server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","-p","3100"],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture",ANTHROPIC_API_KEY:"fixture-never-used"},detached:true,stdio:["ignore","pipe","pipe"]});
 const capture=b=>{log=(log+b).slice(-18000);};server.stdout.on("data",capture);server.stderr.on("data",capture);
 let ready=false;
 for(let i=0;i<100;i++){try{if((await fetch("http://localhost:3100/generation-ui-preview",{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await pause(1000);}
 assert.ok(ready,"Generation fixture starts");
 browser=await chromium.launch({headless:true});
 const jpeg=await readFile("public/reels/softmila-cardigan.jpg");
 for(const [width,locale,theme] of [[390,"en","light"],[1440,"en","dark"],[390,"ar","light"]]){
  const context=await browser.newContext({viewport:{width,height:1000},locale:"en-US",reducedMotion:"reduce"});
  const page=await context.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));
  let calls=0,fail=false;
  await page.route("**/api/creatives/**",route=>route.request().url().includes("/video")?route.fulfill({status:204}):route.fulfill({status:200,contentType:"image/jpeg",body:jpeg}));
  await page.route("**/api/generations/*/advance",async route=>{calls++;await route.fulfill({status:fail?503:204});});
  await page.goto("http://localhost:3100"+(locale==="en"?"":"/"+locale)+"/generation-ui-preview",{waitUntil:"networkidle",timeout:90000});
  await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
  for(const [name,phase] of [["queued","queued"],["preparing","preparing"],["creating","creating"],["finishing","finishing"],["partial","partial"],["failed","failed"],["legacy","partial"],["ready","ready"]]){
   const card=page.locator('[data-case="'+name+'"]');
   assert.equal(await card.locator("[data-generation-status]").getAttribute("data-generation-status"),phase);
  }
  assert.equal(await page.locator('[data-case="creating"] img').count(),3,"Saved images visible while running");
  assert.equal(await page.locator('[data-case="finishing"] video').count(),1,"Saved videos visible while finishing");
  const partial=page.locator('[data-case="partial"]');
  assert.match(await partial.locator("[data-credits-used] dd").textContent(),/20/);
  assert.match(await partial.locator("[data-credits-returned] dd").textContent(),/20/);
  assert.match(await page.locator('[data-case="failed"] [data-credits-returned] dd').textContent(),/10/);
  assert.equal(await page.locator('[data-case="legacy"] [data-credits-returned]').count(),0,"No invented legacy refund");
  assert.equal(await page.locator('[data-case="creating"] [data-credits-returned]').count(),0,"No premature refund");
  const retry=partial.locator('a[href="#generate-ads"]');
  assert.equal(await partial.locator("form").count(),0,"Retry does not submit a paid action");
  const before=calls;await retry.click();await pause(100);
  assert.ok(calls-before<=1,"Retry only navigates to settings; background polling may tick");
  assert.equal(await page.locator("#generate-ads").evaluate(el=>el===document.activeElement),true);
  const poller=page.locator("[data-poller]"), button=poller.locator("button");
  fail=true;await button.click();
  await page.waitForFunction(()=>document.querySelector("[data-poller] p").classList.contains("text-warn"));
  fail=false;await button.click();
  await page.waitForFunction(()=>document.querySelector("[data-poller] p").classList.contains("text-muted"));
  await context.setOffline(true);
  await page.waitForFunction(()=>document.querySelector("[data-poller] p").classList.contains("text-warn"));
  await context.setOffline(false);
  await page.waitForFunction(()=>document.querySelector("[data-poller] p").classList.contains("text-muted"));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"No horizontal overflow");
  if(locale==="en"){
   await partial.scrollIntoViewIfNeeded();
   const b=await partial.screenshot({type:"jpeg",quality:78}),data=b.toString("base64"),name=theme+"-"+width;
   for(let i=0;i<data.length;i+=4000)console.log("GENERATION_IMAGE",name,i/4000,data.slice(i,i+4000));
  }
  assert.deepEqual(errors,[]);
  console.log("PASS generation states, receipts and connection recovery",width,locale,theme);
  await context.close();
 }
}catch(error){console.error(log);throw error;}
finally{if(browser)await browser.close();if(server){try{process.kill(-server.pid,"SIGTERM");}catch{}}await rm(folder,{recursive:true,force:true});}
