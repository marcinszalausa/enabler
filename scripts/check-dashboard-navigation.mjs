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
 'import {AppNav} from "@/app/[locale]/dashboard/app-nav";',
 'import {AccountMenu} from "@/app/[locale]/dashboard/account-menu";',
 'import {MobileMenu,SidebarBody} from "@/app/[locale]/dashboard/app-shell";',
 'import {getMessages} from "@/i18n/messages";import {isLocale} from "@/i18n/config";',
 'export default function Preview(props:{params:Promise<{locale:string}>}){return <Suspense fallback={<p>Loading…</p>}><PreviewContent {...props}/></Suspense>}async function PreviewContent({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(!isLocale(locale))return null;const t=await getMessages(locale);const nav=<AppNav items={[{href:"/navigation-preview",label:t.app.products},{href:"/navigation-preview/ads",label:t.library.title},{href:"/navigation-preview/publishing",label:t.publish.title},{href:"/navigation-preview/brand",label:t.app.brandKit}]}/>;const account=<AccountMenu email="preview@example.com"/>;return <div className="landing flex min-h-screen"><aside data-app-sidebar className="sticky top-0 hidden h-dvh w-60 shrink-0 lg:block"><SidebarBody nav={nav} account={account}/></aside><div className="min-w-0 flex-1"><header className="flex h-16 items-center px-2"><MobileMenu><SidebarBody nav={nav} account={account}/></MobileMenu></header><main className="mx-auto w-full max-w-5xl p-4"><h1 className="text-2xl font-semibold">Navigation preview</h1></main></div></div>}'
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
  // Desktop shows the sidebar; phones and tablets open it as a drawer.
  const phone=width<1024,openNav=async()=>{if(phone&&!(await page.evaluate(()=>[...document.querySelectorAll("[data-app-drawer]")].some(d=>d.open))))await page.locator("[data-app-menu]:visible").click();};
  await openNav();
  const tabs=page.locator("[data-app-tab]:visible");assert.equal(await tabs.count(),4);
  for(let i=0;i<4;i++){const size=await tabs.nth(i).boundingBox();assert.ok(size.height>=44);assert.ok(size.width>=44);}
  for(const [index,path] of [[1,"/ads"],[2,"/publishing"],[3,"/brand"],[0,""]]){
   await openNav();await tabs.nth(index).click();await page.waitForURL(url=>url.pathname.endsWith("/navigation-preview"+path));
   if(phone)assert.equal(await page.evaluate(()=>[...document.querySelectorAll("[data-app-drawer]")].some(d=>d.open)),false,"A section link closes the drawer");
   await openNav();
   await page.waitForFunction(index=>[...document.querySelectorAll("[data-app-tab]")].filter(i=>i.getBoundingClientRect().width>0)[index]?.getAttribute("aria-current")==="page",index);
   assert.equal(await page.locator('[data-app-tab][aria-current="page"]:visible').count(),1);
  }
  // Nested sections keep their parent highlighted, including localized paths.
  await page.goto(base+"/publishing/history",{waitUntil:"networkidle"});await openNav();
  assert.equal(await page.locator('[data-app-tab][aria-current="page"]:visible').getAttribute("href"),"/navigation-preview/publishing");
  await page.goto(base,{waitUntil:"networkidle"});await openNav();
  const menu=page.locator((phone?"[data-app-drawer][open]":"[data-app-sidebar]")+" [data-account-menu]"),summary=menu.locator("summary");
  assert.equal(await menu.locator("button").isVisible(),false);
  await summary.click();assert.equal(await menu.locator("button").isVisible(),true);
  await summary.press("Escape");assert.equal(await menu.getAttribute("open"),null);assert.equal(await summary.evaluate(e=>document.activeElement===e),true);
  await summary.click();
  const policyLink=menu.locator('a[href$="/policies"]');assert.equal(await policyLink.count(),1);assert.ok(await policyLink.isVisible());assert.ok((await policyLink.boundingBox()).height>=44);
  // The expanded account menu may legitimately overlap the heading. Click the
  // outside page gutter below the menu, rather than an obscured element.
  if(phone){const box=await page.locator("[data-app-drawer][open]").boundingBox();await page.mouse.click(box.x+box.width/2,450);}else await page.mouse.click(4,300);assert.equal(await menu.getAttribute("open"),null);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"No horizontal page overflow");
  assert.equal(posts,0,"Navigation never starts generation, signs out, or publishes");
  assert.deepEqual(errors,[]);
  if(width===320){await page.evaluate(()=>scrollTo(0,0));const png=await page.screenshot();console.log("DASHBOARD_NAV_PREVIEW",png.toString("base64"));}
  console.log("PASS dashboard tabs, active routes, account keyboard/dismissal and no side effects",width,locale,theme);
  await page.close();
 }
}catch(error){console.error(log);throw error;}
finally{if(browser)await browser.close();if(server){try{process.kill(-server.pid,"SIGTERM");}catch{}}await rm("src/app/[locale]/navigation-preview",{recursive:true,force:true});}
