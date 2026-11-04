import assert from "node:assert/strict";
import {mkdir,writeFile,rm} from "node:fs/promises";
import {spawn} from "node:child_process";
import {createRequire} from "node:module";
import {setTimeout as pause} from "node:timers/promises";
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
const folder="src/app/[locale]/workflow-preview";
let browser,server,log="";
try{
 await mkdir(folder,{recursive:true});
 await writeFile(folder+"/page.tsx",[
  'import {Suspense} from "react";',
  'import {CampaignForm} from "@/app/[locale]/dashboard/campaigns/campaign-form";',
  'import {CampaignBundle} from "@/app/[locale]/dashboard/campaigns/campaign-bundle";',
  'import {AdRevisions} from "@/app/[locale]/dashboard/products/[id]/ad-revisions";',
  'import {PostingCalendar} from "@/app/[locale]/dashboard/publishing/posting-calendar";',
  'import {AppNav} from "@/app/[locale]/dashboard/app-nav";',
  'const campaign={id:"10000000-0000-4000-8000-000000000001",name:"A softer start",goal:"introduce" as const,message:"Comfortable everyday clothing",offer:"",scene:"Bright daylight"};',
  'export default function Preview(){return <Suspense fallback={<p>Loading…</p>}><Content/></Suspense>}',
  'function Content(){return <main className="landing mx-auto max-w-5xl p-4"><nav className="flex overflow-x-auto"><AppNav items={[{href:"/dashboard",label:"Products"},{href:"/dashboard/ads",label:"My ads"},{href:"/dashboard/campaigns",label:"Campaigns"},{href:"/dashboard/publishing",label:"Publishing"},{href:"/dashboard/brand",label:"Brand kit"}]}/></nav><h1 className="mt-6 text-3xl font-semibold">Your next campaign</h1><CampaignForm id={campaign.id} products={[{id:"product",name:"The Soft Morning Set",url:"https://example.invalid"}]} ideas={[{name:"Holiday gifting",date:"2026-11-01",message:"Show this product as a thoughtful gift without delivery promises."}]}/><CampaignBundle campaign={campaign} copy={[{headline:"Softer mornings",primary_text:"Comfort for your morning routine.",cta:"Shop now",kind:"image",aspect:"1:1"}]}/><section id="revisions" className="mt-6"><AdRevisions creative={{id:"creative",kind:"image",aspect:"1:1",headline:"Softer mornings",primary_text:"Comfort for your morning routine",cta:"Shop now",angle:"benefit"}} productId="product"/></section><section id="calendar" className="mt-6"><PostingCalendar now="2026-11-04T15:00:00Z" timeZone="America/Chicago" posts={[{id:"post",creative_id:null,caption:"Your morning campaign",status:"scheduled",scheduled_for:"2026-11-05T16:00:00Z",created_at:"2026-11-04T15:00:00Z",results:[],error:null,creatives:null}]}/></section><div id="post-post" className="mt-6">Scheduled post details</div></main>}'
 ].join("\n"));
 server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","-p","3115"],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture"},detached:true,stdio:["ignore","pipe","pipe"]});
 const capture=b=>{log=(log+b).slice(-16000);};server.stdout.on("data",capture);server.stderr.on("data",capture);
 let ready=false;for(let i=0;i<90;i++){try{if((await fetch("http://localhost:3115/workflow-preview",{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await pause(1000);}assert.ok(ready,"Fixture ready");
 browser=await chromium.launch({headless:true});
 for(const [width,locale,theme] of [[320,"en","light"],[390,"en","dark"],[390,"ar","light"],[1440,"en","light"]]){
  const page=await browser.newPage({viewport:{width,height:950},reducedMotion:"reduce"});const errors=[];let posts=0;
  page.on("pageerror",e=>errors.push(e.message));page.on("request",r=>{if(r.method()==="POST"&&!new URL(r.url()).pathname.startsWith("/__nextjs")&&!new URL(r.url()).pathname.startsWith("/_next"))posts++;});
  await page.goto("http://localhost:3115"+(locale==="en"?"":"/"+locale)+"/workflow-preview",{waitUntil:"networkidle",timeout:90000});
  await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
  assert.equal(await page.locator("[data-app-tab]").count(),5);
  await page.getByRole("button",{name:/Holiday gifting/}).click();assert.equal(await page.locator('input[name="name"]').first().inputValue(),"Holiday gifting");
  await page.locator('label:has(input[name="goal"][value="offer"])').click();assert.ok(await page.locator('textarea[name="offer"]').isVisible());assert.equal(await page.locator('textarea[name="offer"]').getAttribute("required"),"");
  await page.locator('label:has(input[name="goal"][value="introduce"])').click();assert.equal(await page.locator('textarea[name="offer"]').count(),0);
  await page.getByText("Choose a setting (optional)",{exact:true}).click();await page.locator('input[name="scene"]').first().fill("Bright studio, clear background");
  const download=page.waitForEvent("download");await page.getByRole("button",{name:"Download campaign copy"}).click();assert.equal((await download).suggestedFilename(),"gooidy-campaign-copy.txt");
  await page.getByText("Edit headline and caption · no credits",{exact:true}).click();await page.locator('#revisions input[name="headline"]').fill("A better morning");
  await page.getByText("Try a different scene",{exact:true}).click();assert.ok((await page.locator('#revisions input[name="id"]').inputValue()).length===36);
  const calendar=page.locator("[data-posting-calendar]");assert.ok(await calendar.getByText("Your morning campaign",{exact:true}).isVisible());assert.ok(await calendar.getByText(await page.evaluate(locale=>new Date("2026-11-05T16:00:00Z").toLocaleTimeString(locale,{timeZone:"America/Chicago",hour:"numeric",minute:"2-digit"}),locale),{exact:true}).isVisible(),"Saved time zone applied");
  await calendar.getByRole("button",{name:"Next week"}).click();assert.equal(await calendar.getByText("Your morning campaign",{exact:true}).count(),0);await calendar.getByRole("button",{name:"This week"}).click();assert.ok(await calendar.getByText("Your morning campaign",{exact:true}).isVisible());
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"No horizontal page overflow");assert.equal(posts,0,"Planning UI never generates, publishes or spends automatically");assert.deepEqual(errors,[]);
  if(width===320){await page.evaluate(()=>scrollTo(0,0));console.log("WORKFLOW_PREVIEW",(await page.screenshot({type:"jpeg",quality:70})).toString("base64"));await calendar.scrollIntoViewIfNeeded();console.log("CALENDAR_PREVIEW",(await page.screenshot({type:"jpeg",quality:70})).toString("base64"));}
  console.log("PASS campaign ideas, offer validation, scene settings, copy download, revisions, calendar, mobile/RTL and no automatic spending",width,locale,theme);await page.close();
 }
}catch(error){console.error(log);throw error;}
finally{if(browser)await browser.close();if(server){try{process.kill(-server.pid,"SIGTERM");}catch{}}await rm(folder,{recursive:true,force:true});}
