import assert from "node:assert/strict";
import {mkdir,writeFile,readFile,rm} from "node:fs/promises";
import {spawn,execFileSync} from "node:child_process";
import {createRequire} from "node:module";
import {setTimeout as pause} from "node:timers/promises";
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
const folder="src/app/[locale]/library-preview";
const database=process.env.CREDIT_TEST_DATABASE_URL;
assert.ok(database?.endsWith("/library_tests"),"Disposable library database required");
const sql=statement=>execFileSync("psql",[database,"-XAtq","-v","ON_ERROR_STOP=1","-c",statement],{encoding:"utf8"}).trim();
const balances=sql("select sum(credits) from public.workspaces");
const stubPath="src/lib/supabase/server.ts",originalClient=await readFile(stubPath,"utf8");
let server,browser,log="";
const favoriteId="84000000-0000-4000-8000-000000000027";
try{
 await writeFile(stubPath,'import {libraryTestClient} from "../../../scripts/library-fixture-client";export async function createClient(){return libraryTestClient();}');
 await mkdir(folder,{recursive:true});
 await writeFile(folder+"/page.tsx",[
 'import {Suspense} from "react";import AdsPage from "@/app/[locale]/dashboard/ads/page";import DashboardLayout from "@/app/[locale]/dashboard/layout";',
 'export default function Fixture(props:{params:Promise<{locale:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){return <Suspense fallback={<p>Loading…</p>}><DashboardLayout params={props.params}><AdsPage {...props}/></DashboardLayout></Suspense>}'
 ].join("\n"));
 const jpeg=await readFile("public/reels/softmila-cardigan.jpg");
 execFileSync(require("ffmpeg-static"),["-i","public/reels/softmila-cardigan.mp4","-t","1","-an","-vf","scale=240:-2","-r","15","-deadline","realtime","-cpu-used","8","-c:v","libvpx-vp9","-threads","2","-b:v","200k","-y","/tmp/library-preview.webm"],{stdio:"ignore",timeout:60000});
 const video=await readFile("/tmp/library-preview.webm");
 server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","-p","3111"],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture"},detached:true,stdio:["ignore","pipe","pipe"]});
 const capture=b=>{log=(log+b).slice(-18000);};server.stdout.on("data",capture);server.stderr.on("data",capture);
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch("http://localhost:3111/library-preview",{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await pause(1000);}assert.ok(ready,"Library fixture ready");
 browser=await chromium.launch({headless:true});
 for(const [width,locale,theme] of [[320,"en","light"],[390,"pl","dark"],[390,"ja","light"],[1440,"en","dark"]]){
  sql("delete from public.creative_favorites where user_id='81000000-0000-4000-8000-000000000001' and creative_id='"+favoriteId+"'");
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:"reduce"});
  const page=await context.newPage(),errors=[],videoRequests=[];
  let paid=0;page.on("pageerror",e=>errors.push(e.message));
  page.on("request",r=>{if(r.method()==="POST"&&(/\/auth\/signout|\/dashboard\/products\/|\/dashboard\/publishing/.test(new URL(r.url()).pathname)))paid++;});
  await page.route("**/api/creatives/*/image?**",route=>{
   assert.equal(new URL(route.request().url()).searchParams.get("preview"),"1","Only bounded images load while browsing");
   return route.fulfill({status:200,contentType:"image/jpeg",body:jpeg});
  });
  await page.route("**/api/creatives/*/video",route=>{videoRequests.push(route.request().url());return route.fulfill({status:200,contentType:"video/webm",body:video});});
  await page.route("**/library-preview**",async route=>{if(route.request().method()==="POST")await pause(500);await route.continue();});
  const base="http://localhost:3111"+(locale==="en"?"":"/"+locale)+"/library-preview";
  const visit=async(query="")=>{await page.goto(base+query,{waitUntil:"networkidle",timeout:90000});await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);};
  await visit();
  // Desktop shows the sidebar; phones open it as a drawer from the menu button.
  if(width<1024)await page.click("[data-app-menu]");
  assert.equal(await page.locator("[data-app-tab]:visible").count(),6);
  assert.equal(await page.locator('[data-app-tab][href="/dashboard/stores"]:visible').count(),1);
  if(width<1024){await page.keyboard.press("Escape");assert.equal(await page.evaluate(()=>[...document.querySelectorAll("[data-app-drawer]")].some(d=>d.open)),false);}
  assert.equal(await page.locator("[data-library-ad]").count(),24);
  assert.equal(await page.locator("video").count(),0);
  const next=page.locator('a[href="/dashboard/ads?page=2"]');assert.equal(await next.count(),1);
  await visit("?page=2");assert.equal(await page.locator("[data-library-ad]").count(),7);
  await visit("?kind=video");assert.equal(await page.locator("[data-library-ad]").count(),2);assert.equal(await page.locator("video").count(),0);
  assert.equal(videoRequests.length,0,"Video data waits for an explicit preview");
  await page.locator("[data-library-preview]").first().click();
  await page.locator("dialog[open] video").waitFor();
  await page.waitForFunction(()=>document.querySelector("dialog video")?.readyState>=2);
  assert.equal(videoRequests.length,1);
  await page.locator("dialog[open]").press("Escape");await page.waitForFunction(()=>!document.querySelector("dialog video"));
  await visit();
  const card=page.locator('[data-library-ad="'+favoriteId+'"]');
  const open=await card.locator('a[href*="favorite="]').getAttribute("href");assert.ok(open.includes("favorite="+favoriteId));assert.ok(open.includes("#ad-83000000-0000-4000-8000-000000000001"));
  assert.ok(await card.locator('a[href*="download=1"]').count());
  await card.locator("[data-library-preview]").click();await page.locator("dialog[open] img").waitFor();assert.equal(await page.locator("dialog[open] img").count(),1);await page.locator("dialog[open]").press("Escape");
  let save=card.locator("[data-favorite-form] button");
  if(width===320){
   sql("revoke insert on public.creative_favorites from authenticated");
   await save.click();await card.locator('[role="alert"]').waitFor();assert.equal(await save.getAttribute("aria-pressed"),"false");
   sql("grant insert on public.creative_favorites to authenticated");
  }
  await save.click();
  await page.waitForFunction(id=>document.querySelector('[data-library-ad="'+id+'"] [data-favorite-form] button')?.getAttribute("aria-pressed")==="true",favoriteId);
  await page.reload({waitUntil:"networkidle"});
  assert.equal(await page.locator('[data-library-ad="'+favoriteId+'"] [data-favorite-form] button').getAttribute("aria-pressed"),"true","Favorite survives reload");
  await visit("?favorites=1");assert.equal(await page.locator("[data-library-ad]").count(),3);
  await page.locator('[data-library-ad="'+favoriteId+'"] [data-favorite-form] button').click();
  await page.waitForFunction(id=>document.querySelector('[data-library-ad="'+id+'"] [data-favorite-form] button')?.getAttribute("aria-pressed")!=="true",favoriteId);
  await page.reload({waitUntil:"networkidle"});assert.equal(await page.locator("[data-library-ad]").count(),2);
  await visit("?kind=video&favorites=1");assert.equal(await page.locator("[data-library-ad]").count(),0);assert.equal(await page.locator(':is([data-app-sidebar], #app-content) a[href="/dashboard/ads"]:visible').count(),width<1024?1:2); // Reset link, plus the My ads section in the desktop sidebar (phones keep it in the closed drawer).
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"No horizontal overflow");
  assert.equal(paid,0);assert.deepEqual(errors,[]);
  console.log("PASS library pagination, filters, private persistent favorites, error recovery, previews, deep links and no paid side effects",width,locale,theme);
  if(width===320){await visit();const png=await page.screenshot();console.log("LIBRARY_PREVIEW",png.toString("base64"));}
  await context.close();
 }
 assert.equal(sql("select sum(credits) from public.workspaces"),balances,"Browsing and saving do not spend credits");
}catch(error){console.error(log);throw error;}
finally{sql("grant insert on public.creative_favorites to authenticated");if(browser)await browser.close();if(server){try{process.kill(-server.pid,"SIGTERM");}catch{}}await writeFile(stubPath,originalClient);await rm(folder,{recursive:true,force:true});}

