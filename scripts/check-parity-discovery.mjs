import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createRequire} from "node:module";
import {setTimeout as pause} from "node:timers/promises";
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
let browser,server,log="";
try{
 server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","-p","3121"],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture"},detached:true,stdio:["ignore","pipe","pipe"]});
 const capture=b=>{log=(log+b).slice(-14000);};server.stdout.on("data",capture);server.stderr.on("data",capture);
 let ready=false;for(let i=0;i<90;i++){try{if((await fetch("http://localhost:3121/help",{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await pause(1000);}assert.ok(ready,"Help route ready");
 browser=await chromium.launch({headless:true});
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:"reduce"});const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("http://localhost:3121/help",{waitUntil:"networkidle"});await page.getByLabel("What do you need help with?").fill("caption edit");await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent==="1 guide found");
  await page.getByRole("link",{name:/Change an ad’s wording/}).click();await page.locator("h1:visible").filter({hasText:"Change an ad’s wording"}).waitFor();
  for(const path of ["/templates","/industries","/industries/clothing","/industries/beauty","/platforms","/platforms/youtube","/blog","/blog/review-before-publishing"]){
   const response=await page.goto("http://localhost:3121"+path,{waitUntil:"networkidle"});assert.equal(response.status(),200,path);assert.equal(await page.locator("h1:visible").count(),1,path);if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))console.log("OVERFLOW",await page.evaluate(()=>Array.from(document.querySelectorAll("main *")).filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,15).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width,text:e.textContent.slice(0,80)}))));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"No horizontal overflow: "+path);
   assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"),"https://gooidy.com"+path);
   if(path==="/industries/beauty")assert.ok(await page.getByText("Illustrative concept",{exact:false}).isVisible());
  }
  assert.deepEqual(errors,[]);console.log("PASS discovery routes and search",width);await page.close();
 }
 const missing=await fetch("http://localhost:3121/industries/not-real");const missingHtml=await missing.text();assert.ok(missing.status===404||(missing.status===200&&/<meta name="robots" content="noindex"/.test(missingHtml)),"Unknown guides return a 404 or streamed noindex not-found page");
 const sitemap=await(await fetch("http://localhost:3121/sitemap.xml")).text();for(const path of ["/industries/clothing","/help/first-campaign","/platforms/youtube","/blog/choose-an-ad-angle"])assert.ok(sitemap.includes("https://gooidy.com"+path));console.log("PASS missing route and sitemap");
}catch(error){console.error(log);throw error;}finally{await browser?.close();if(server?.pid)try{process.kill(-server.pid,"SIGTERM");}catch{}}
