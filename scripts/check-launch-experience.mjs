import assert from "node:assert/strict";
import {mkdir,writeFile,rm} from "node:fs/promises";
import {spawn} from "node:child_process";
import {createRequire} from "node:module";
import {setTimeout as pause} from "node:timers/promises";
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
const folders=["src/app/[locale]/recovery-check","src/app/[locale]/recovery-client","src/app/[locale]/recovery-app","src/app/[locale]/recovery-form"];
const serverPage='import {Suspense} from "react";import {cookies} from "next/headers";export default function Page(){return <Suspense fallback={<p>Loading fixture</p>}><Content/></Suspense>}async function Content(){const jar=await cookies();if(jar.get("recovery-ready")?.value!=="yes")throw new Error("FIXTURE_INTERNAL_ERROR_DO_NOT_DISPLAY");return <h1 data-recovered>Recovered</h1>;}';
let browser,server,log="";
try{
 for(const folder of folders)await mkdir(folder,{recursive:true});
 await writeFile(folders[0]+"/page.tsx",serverPage);
 await writeFile(folders[1]+"/page.tsx",'"use client";import {useEffect,useState} from "react";export default function Page(){const [mounted,setMounted]=useState(false);useEffect(()=>{setMounted(true)},[]);if(mounted&&!document.cookie.includes("recovery-ready=yes"))throw new Error("FIXTURE_INTERNAL_CLIENT_ERROR");return <h1 data-recovered>Recovered client</h1>;}');
 await writeFile(folders[2]+"/page.tsx",serverPage);
 await writeFile(folders[2]+"/layout.tsx",'export {default} from "@/app/[locale]/dashboard/layout";');
 await writeFile(folders[2]+"/error.tsx",'"use client";export {default} from "@/app/[locale]/dashboard/error";');
 await writeFile(folders[3]+"/page.tsx",'import {UrlForm} from "@/app/_landing/chrome";export default function Page(){return <main className="mx-auto max-w-xl p-4"><h1>Link fixture</h1><UrlForm id="fixture-url"/></main>;}');
 server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","-p","3114"],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture"},detached:true,stdio:["ignore","pipe","pipe"]});
 const capture=b=>{log=(log+b).slice(-18000);};server.stdout.on("data",capture);server.stderr.on("data",capture);
 let ready=false;for(let n=0;n<100;n++){try{if((await fetch("http://localhost:3114/recovery-form",{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await pause(1000);}assert.ok(ready);
 browser=await chromium.launch({headless:true});
 for(const [width,locale] of [[320,"en"],[390,"pl"],[390,"ar"],[1440,"en"]]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:"reduce"});
  const page=await context.newPage(),prefix=locale==="en"?"":"/"+locale;
  const posts=[];page.on("request",r=>{const path=new URL(r.url()).pathname;if(r.method()==="POST"&&!path.startsWith("/__nextjs")&&!path.startsWith("/_next")&&path!=="/api/onboarding/preview")posts.push(path);});
  for(const route of ["recovery-check","recovery-client","recovery-app"]){
   await context.addCookies([{name:"recovery-ready",value:"no",url:"http://localhost:3114"}]);
   await page.goto("http://localhost:3114"+prefix+"/"+route,{waitUntil:"domcontentloaded",timeout:90000});
   await page.locator("[data-recovery-panel]").waitFor();
   await page.addStyleTag({content:"nextjs-portal{display:none!important}"});
   const panel=page.locator("[data-recovery-panel]");
   assert.ok(!(await panel.innerText()).includes("FIXTURE_INTERNAL"));
   assert.equal(await panel.locator('a[href="mailto:hello@gooidy.com"]').count(),1);
   assert.equal(await panel.locator("[data-recovery-home]").getAttribute("href"),route==="recovery-app"?"/dashboard":prefix||"/");
   for(const box of await panel.locator("button,a").evaluateAll(xs=>xs.map(x=>({w:x.getBoundingClientRect().width,h:x.getBoundingClientRect().height}))))assert.ok(box.h>=44&&box.w>=44);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(width===320&&route==="recovery-check")console.log("RECOVERY_PREVIEW",(await page.screenshot()).toString("base64"));
   await context.addCookies([{name:"recovery-ready",value:"yes",url:"http://localhost:3114"}]);
   await panel.locator("[data-recovery-retry]").click();
   await page.locator("[data-recovered]").waitFor({timeout:30000});
   assert.equal(await page.locator("[data-recovery-panel]").count(),0);
   console.log("LAUNCH_RECOVERY_VERIFIED",JSON.stringify({width,locale,route}));
  }
  await page.route("**/api/onboarding/preview",r=>r.fulfill({status:503,body:"Unavailable"}));
  await page.goto("http://localhost:3114"+prefix+"/recovery-form");
  const input=page.locator("#fixture-url");
  await input.fill("not a product link");
  await page.locator('button[type="submit"]').click();
  assert.equal(await input.inputValue(),"not a product link");
  assert.equal(await input.getAttribute("aria-invalid"),"true");
  assert.equal(await input.getAttribute("aria-describedby"),"fixture-url-error");
  assert.equal(await page.locator("#fixture-url-error").getAttribute("role"),"alert");
  assert.ok(await input.evaluate(i=>document.activeElement===i));
  await input.fill("softmila.com/products/example");
  assert.equal(await input.getAttribute("aria-invalid"),null);
  await page.locator('button[type="submit"]').click();
  await page.locator('[data-onboarding-step="2"]').waitFor();
  assert.equal(new URL(page.url()).searchParams.get("url"),"softmila.com/products/example");
  await page.waitForFunction(()=>document.querySelector("[data-preview-state]")?.getAttribute("data-preview-state")==="error");
  assert.ok(await page.locator("[data-continue-account]").isEnabled());
  await page.goto("http://localhost:3114"+prefix+"/start?url=not-a-link");
  await page.locator('[data-onboarding-step="1"]').waitFor();
  assert.equal(await page.locator("#setup-url").inputValue(),"not-a-link");
  assert.equal(await page.locator("#setup-url").getAttribute("aria-describedby"),"setup-url-error");
  assert.equal(await page.locator("#setup-url-error").getAttribute("role"),"alert");
  assert.deepEqual(posts,[]);
  console.log("LAUNCH_LINK_CORRECTION_VERIFIED",JSON.stringify({width,locale,posts:0}));
  if(width===320)console.log("LAUNCH_PREVIEW",(await page.screenshot()).toString("base64"));
  await context.close();
 }
} catch(e){console.log(log.slice(-10000));throw e;}
finally{await browser?.close();if(server){try{process.kill(-server.pid,"SIGTERM");}catch{}}for(const folder of folders)await rm(folder,{recursive:true,force:true});}
