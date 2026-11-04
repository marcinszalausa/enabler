import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createRequire} from "node:module";
import {setTimeout as pause} from "node:timers/promises";
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
const documents=["/terms","/privacy","/policies/billing","/policies/cookies","/policies/acceptable-use","/policies/privacy-requests"];
let browser,server,log="";
try{
 server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","-p","3115"],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture",BILLING_ENABLED:"true",STRIPE_SECRET_KEY:"not-a-real-key"},detached:true,stdio:["ignore","pipe","pipe"]});
 const capture=b=>{log=(log+b).slice(-12000);};server.stdout.on("data",capture);server.stderr.on("data",capture);
 let ready=false;for(let n=0;n<100;n++){try{if((await fetch("http://localhost:3115/policies",{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await pause(1000);}assert.ok(ready);
 browser=await chromium.launch({headless:true});
 for(const [width,locale] of [[320,"en"],[390,"es"],[390,"ar"],[1440,"en"]]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:"reduce"}),page=await context.newPage();
  const prefix=locale==="en"?"":"/"+locale,errors=[],mutations=[],external=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("request",r=>{const u=new URL(r.url());if(r.method()==="POST"&&!u.pathname.startsWith("/__nextjs")&&!u.pathname.startsWith("/_next"))mutations.push(u.pathname);if(!["localhost","127.0.0.1"].includes(u.hostname))external.push(u.hostname);});
  await page.goto("http://localhost:3115"+prefix+"/policies");
  assert.equal(await page.locator("[data-policy-directory] a").count(),6);
  for(const path of documents){
   const response=await page.goto("http://localhost:3115"+prefix+path,{waitUntil:"domcontentloaded",timeout:90000});assert.equal(response.status(),200);
   await page.locator("[data-policy-document]").waitFor();
   assert.equal(await page.locator("article").getAttribute("lang"),"en");
   assert.equal(await page.locator("[data-prelaunch-legal]").count(),0);
   assert.ok((await page.locator("[data-policy-version]").innerText()).includes("2026-11-04-r2"));
   assert.ok(!/pre[-\s]?launch|unspecified|pending entity formation|not (?:yet )?finalized|draft (?:terms|policies)/i.test(await page.locator("main").innerText()));
   const anchors=await page.locator('nav[aria-label="On this page"] a').evaluateAll(xs=>xs.map(x=>x.getAttribute("href")));
   for(const anchor of anchors)assert.equal(await page.locator(anchor).count(),1);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(path==="/policies/privacy-requests"){
    const links=await page.locator("[data-privacy-request-options] a").evaluateAll(xs=>xs.map(x=>({href:x.href,height:x.getBoundingClientRect().height})));
    assert.equal(links.length,4);
    for(const a of links){const url=new URL(a.href);assert.equal(url.protocol,"mailto:");assert.equal(url.pathname,"hello@gooidy.com");assert.ok(url.searchParams.get("body").includes("verification"));assert.ok(a.height>=44);}
    if(width===320)console.log("POLICY_PREVIEW",(await page.screenshot({fullPage:false})).toString("base64"));
   }
  }
  await page.goto("http://localhost:3115"+prefix+"/policies/no-such-policy");
  assert.equal(await page.locator("[data-policy-document]").count(),0);
  await page.goto("http://localhost:3115"+prefix+"/");
  await page.locator("#pricing").waitFor();
  assert.equal(await page.locator("[data-checkout-unavailable]").count(),0);
  const paid=page.locator('#pricing a[href$="/pricing#compare-plan-features"]');assert.equal(await paid.count(),2);for(const link of await paid.all())assert.match(await link.innerText(),/^Explore /);
  const offers=await page.locator('script[type="application/ld+json"]').evaluateAll(xs=>xs.map(x=>JSON.parse(x.textContent)));
  assert.ok(!JSON.stringify(offers).includes('"price":29'));assert.ok(!JSON.stringify(offers).includes('"price":79'));
  await page.goto("http://localhost:3115"+prefix+"/pricing");assert.ok(await page.locator('main a[href$="/policies/billing"]').count()>0,"Billing terms remain accessible from plan details");
  await page.goto("http://localhost:3115/login");
  await page.locator("[data-account-form]").waitFor();
  assert.equal(await page.locator("[data-checkout-unavailable]").count(),0);
  assert.ok(!/pre[-\s]?launch|unspecified|pending entity formation|not (?:yet )?finalized|draft (?:terms|policies)/i.test(await page.locator("main").innerText()));
  assert.deepEqual(mutations,[]);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  console.log("LEGAL_BROWSER_VERIFIED",JSON.stringify({width,locale,documents:6,mailDrafts:4,externalRequests:0}));
  await context.close();
 }
 for(const body of ["","not-json",JSON.stringify({plan:"growth",accepted:true,country:"US"})]){
  const response=await fetch("http://localhost:3115/api/billing/checkout",{method:"POST",headers:{"content-type":"application/json"},body});
  assert.equal(response.status,503);assert.equal((await response.json()).code,"CHECKOUT_NOT_AVAILABLE");assert.equal(response.headers.get("location"),null);assert.equal(response.headers.get("cache-control"),"no-store");
 }
 const get=await fetch("http://localhost:3115/api/billing/checkout");assert.equal(get.status,405);
 console.log("CHECKOUT_LOCK_VERIFIED",JSON.stringify({posts:3,sessionCreated:false,environmentCannotEnable:true}));
} catch(e){console.log(log.slice(-10000));throw e;}
finally{await browser?.close();if(server){try{process.kill(-server.pid,"SIGTERM");}catch{}}}
