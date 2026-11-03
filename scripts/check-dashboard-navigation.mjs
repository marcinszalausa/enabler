import assert from "node:assert/strict";
import {mkdir,writeFile,rm} from "node:fs/promises";
import {spawn} from "node:child_process";
import {createRequire} from "node:module";
import {setTimeout as pause} from "node:timers/promises";
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
const folder="src/app/[locale]/navigation-preview/[[...section]]";
let browser,server,log="";
try{
 await mkdir(folder,{recursive:true});
 await writeFile(folder+"/page.tsx",[
 'import {Suspense} from "react";',
 'import {AppBar} from "@/app/_landing/chrome";',
 'import {AppNav} from "@/app/[locale]/dashboard/app-nav";',
 'import {AccountMenu} from "@/app/[locale]/dashboard/account-menu";',
 'import {ProductJourney} from "@/app/[locale]/dashboard/product-journey";',
 'import {getMessages} from "@/i18n/messages";import {isLocale} from "@/i18n/config";',
 'export default function Preview(props:{params:Promise<{locale:string}>}){return <Suspense fallback={<p>Loading…</p>}><PreviewContent {...props}/></Suspense>}async function PreviewContent({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(!isLocale(locale))return null;const t=await getMessages(locale);return <div className="landing flex min-h-screen flex-col"><AppBar homeHref="/navigation-preview" tabs={<AppNav items={[{href:"/navigation-preview",label:t.app.products},{href:"/navigation-preview/publishing",label:t.publish.title},{href:"/navigation-preview/brand",label:t.app.brandKit}]}/>}><AccountMenu/></AppBar><main className="mx-auto w-full max-w-5xl p-4"><h1 className="text-2xl font-semibold">Navigation preview</h1><div data-state="preferences"><ProductJourney t={t} needsPreferences/></div><div data-state="new"><ProductJourney t={t}/></div><div data-state="running"><ProductJourney t={t} running/></div><div data-state="ready"><ProductJourney t={t} hasAds/></div><div data-state="posted"><ProductJourney t={t} hasAds posted/></div><div data-state="viewer"><ProductJourney t={t} hasAds canEdit={false}/></div><div className="h-[800px]"/>{["ad-preferences","generate-ads","your-ads"].map(id=><section id={id} key={id} tabIndex={-1} className="min-h-[600px] scroll-mt-40 border p-4">{id}</section>)}</main></div>}'
 ].join("\n"));
 server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","-p","3109"],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture"},detached:true,stdio:["ignore","pipe","pipe"]});
 const capture=b=>{log=(log+b).slice(-16000);};server.stdout.on("data",capture);server.stderr.on("data",capture);
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch("http://localhost:3109/navigation-preview",{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await pause(1000);}assert.ok(ready,"Fixture ready");
 browser=await chromium.launch({headless:true});
 for(const [width,locale,theme] of [[320,"en","light"],[390,"pl","dark"],[390,"ar","light"],[768,"de","light"],[1440,"en","dark"]]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:"reduce"});const errors=[];let posts=0;
  page.on("pageerror",e=>errors.push(e.message));page.on("request",r=>{if(r.method()==="POST"){const path=new URL(r.url()).pathname;if(!path.startsWith("/__nextjs")&&!path.startsWith("/_next")){posts++;console.log("UNEXPECTED_POST",path);}}});
  const prefix=locale==="en"?"":"/"+locale;
  const base="http://localhost:3109"+prefix+"/navigation-preview";
  await page.goto(base,{waitUntil:"networkidle",timeout:90000});
  await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
  const tabs=page.locator("[data-app-tab]:visible");assert.equal(await tabs.count(),3);
  for(let i=0;i<3;i++){const size=await tabs.nth(i).boundingBox();assert.ok(size.height>=44);assert.ok(size.width>=44);}
  for(const [index,path] of [[1,"/publishing"],[2,"/brand"],[0,""]]){
   await tabs.nth(index).click();await page.waitForURL(url=>url.pathname.endsWith("/navigation-preview"+path));
   await page.waitForFunction(index=>[...document.querySelectorAll("[data-app-tab]")].filter(i=>i.getBoundingClientRect().width>0)[index]?.getAttribute("aria-current")==="page",index);
   assert.equal(await page.locator('[data-app-tab][aria-current="page"]:visible').count(),1);
  }
  // Nested sections keep their parent highlighted, including localized paths.
  await page.goto(base+"/publishing/history",{waitUntil:"networkidle"});
  assert.equal(await page.locator('[data-app-tab][aria-current="page"]:visible').getAttribute("href"),"/navigation-preview/publishing");
  await page.goto(base,{waitUntil:"networkidle"});
  const menu=page.locator("[data-account-menu]"),summary=menu.locator("summary");
  assert.equal(await menu.locator("button").isVisible(),false);
  await summary.click();assert.equal(await menu.locator("button").isVisible(),true);
  await summary.press("Escape");assert.equal(await menu.getAttribute("open"),null);assert.equal(await summary.evaluate(e=>document.activeElement===e),true);
  await summary.click();await page.locator("h1").click();assert.equal(await menu.getAttribute("open"),null);
  for(const [state,href,step] of [["preferences","#ad-preferences",1],["new","#generate-ads",2],["running","#your-ads",2],["ready","#your-ads",3],["posted","/dashboard/publishing",null],["viewer","#your-ads",3]]){
   const group=page.locator('[data-state="'+state+'"]');
   assert.equal(await group.locator("[data-next-step]").count(),1);
   assert.equal(await group.locator("[data-next-step]").getAttribute("href"),href);
   assert.equal(await group.locator('li[aria-current="step"]').count(),step===null?0:1);
  }
  await page.addStyleTag({content:"html{scroll-behavior:auto!important}"});
  for(const [state,id] of [["preferences","ad-preferences"],["new","generate-ads"],["ready","your-ads"]]){
   await page.locator('[data-state="'+state+'"] [data-next-step]').click();await pause(300);
   const target=await page.locator("#"+id).boundingBox(),header=await page.locator("header").boundingBox();
   assert.ok(target.y>=header.y+header.height-1,"Destination clears sticky navigation");
   assert.ok(target.y<900,"Destination is visible");
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"No horizontal page overflow");
  assert.equal(posts,0,"Navigation never starts generation, signs out, or publishes");
  assert.deepEqual(errors,[]);
  if(width===320){await page.evaluate(()=>scrollTo(0,0));const png=await page.screenshot();console.log("DASHBOARD_NAV_PREVIEW",png.toString("base64"));}
  console.log("PASS dashboard tabs, active routes, account keyboard/dismissal, next steps, anchors and no side effects",width,locale,theme);
  await page.close();
 }
}catch(error){console.error(log);throw error;}
finally{if(browser)await browser.close();if(server){try{process.kill(-server.pid,"SIGTERM");}catch{}}await rm("src/app/[locale]/navigation-preview",{recursive:true,force:true});}
