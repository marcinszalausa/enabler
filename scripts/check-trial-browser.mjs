import assert from "node:assert/strict";
import {mkdir,writeFile,rm} from "node:fs/promises";
import {spawn} from "node:child_process";
import {createRequire} from "node:module";
import {setTimeout as pause} from "node:timers/promises";
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
const folder="src/app/[locale]/trial-preview";
let server,browser,log="";
try{
 await mkdir(folder,{recursive:true});
 await writeFile(folder+"/page.tsx",'import {TrialCampaign} from "@/app/[locale]/dashboard/trial-campaign";import {GenerateControls} from "@/app/[locale]/dashboard/products/[id]/generate-controls";export default function Preview(){const props={productId:"fixture",imageRequestId:"71000000-0000-4000-8000-000000000001",videoRequestId:"71000000-0000-4000-8000-000000000002",imageCost:10,videoCost:40,videoLabel:"Create 2 videos",defaultLanguage:"english" as const};return <main className="mx-auto max-w-5xl p-4"><div data-new><TrialCampaign credits={100} hasAds={false} published={false}/></div><div data-free className="mt-6"><GenerateControls {...props} credits={100} freeTrial/></div><div data-complete><TrialCampaign credits={95} hasAds published/></div><div data-paid className="mt-6"><GenerateControls {...props} credits={100}/></div><div data-zero className="mt-6"><GenerateControls {...props} credits={0} freeTrial initialKind="video"/></div></main>}');
 server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","-p","3100"],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture",ANTHROPIC_API_KEY:"fixture-never-used"},detached:true,stdio:["ignore","pipe","pipe"]});
 const capture=b=>{log=(log+b).slice(-12000);};server.stdout.on("data",capture);server.stderr.on("data",capture);
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch("http://localhost:3100/trial-preview",{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await pause(1000);}assert.ok(ready);
 browser=await chromium.launch({headless:true});
 for(const [width,locale,theme] of [[320,"en","light"],[390,"en","light"],[1440,"en","dark"],[390,"ar","light"]]){
  const context=await browser.newContext({viewport:{width,height:1100},reducedMotion:"reduce"});
  const page=await context.newPage(),errors=[];let posts=0;
  page.on("pageerror",e=>errors.push(e.message));page.on("request",r=>{if(r.method()==="POST")posts++;});
  await page.goto("http://localhost:3100"+(locale==="en"?"":"/"+locale)+"/trial-preview",{waitUntil:"networkidle",timeout:90000});
  await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
  const free=page.locator("[data-free]"),fresh=page.locator("[data-new]"),complete=page.locator("[data-complete]");
  assert.equal(await free.locator("form").count(),1);
  assert.equal(await free.locator('input[name="kind"]').count(),0);
  assert.equal(await fresh.locator('a[href="/#pricing"]').count(),0);
  assert.equal(await complete.locator('a[href="/#pricing"]').count(),1);
  assert.ok((await fresh.locator("[data-image-capacity]").innerText()).includes("100"));
  assert.ok((await complete.locator("[data-image-capacity]").innerText()).includes("90"));
  assert.equal(await fresh.locator("ol li svg").count(),3);
  await free.locator('button[aria-pressed="false"]').click();
  assert.equal(await free.locator('input[name="kind"]').inputValue(),"video");
  assert.ok((await free.locator("[data-video-balance]").innerText()).includes("60"));
  await free.locator("details summary").click();
  await free.locator('input[name="length"][value="30"]').check();
  assert.equal(await free.locator('button[type="submit"]').isDisabled(),true);
  assert.ok((await free.locator("[data-video-balance]").innerText()).includes("180"));
  await free.locator('input[name="length"][value="7"]').check();
  assert.equal(await free.locator('button[type="submit"]').isEnabled(),true);
  assert.equal(await page.locator('[data-zero] button[type="submit"]').isDisabled(),true);
  assert.equal(await page.locator('[data-paid] button[aria-pressed]').count(),0);
  assert.equal(await page.locator('[data-paid] form').count(),1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.equal(posts,0);assert.deepEqual(errors,[]);
  console.log("PASS trial image default, usable capacity, video cost/insufficient balance, post-value plans and layout",width,locale,theme);
  await context.close();
 }
}catch(error){console.error(log);throw error;}
finally{if(browser)await browser.close();if(server){try{process.kill(-server.pid,"SIGTERM");}catch{}}await rm(folder,{recursive:true,force:true});}
