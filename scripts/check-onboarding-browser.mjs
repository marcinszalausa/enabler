import assert from "node:assert/strict";
import {mkdir,writeFile,readFile,rm} from "node:fs/promises";
import {spawn} from "node:child_process";
import {createRequire} from "node:module";
import {setTimeout as pause} from "node:timers/promises";
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
const folder="src/app/[locale]/onboarding-controls-preview";
let server,browser,log="";
try{
 await mkdir(folder,{recursive:true});await writeFile(folder+"/page.tsx","import { GenerateControls } from \"@/app/[locale]/dashboard/products/[id]/generate-controls\";\nimport { Nav, UrlForm } from \"@/app/_landing/chrome\";\nexport default function Preview(){return <main className=\"landing mx-auto max-w-5xl p-4\"><Nav/><div data-public-form className=\"py-10\"><UrlForm id=\"preview-product-url\"/></div><section data-guided-controls><GenerateControls productId=\"fixture-product\" imageRequestId=\"10000000-0000-4000-8000-000000000001\" videoRequestId=\"10000000-0000-4000-8000-000000000002\" imageCost={10} videoCost={40} videoLabel=\"Create 2 videos\" defaultLanguage=\"english\" initialKind=\"video\"/></section></main>}");
 server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","-p","3100"],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture",ANTHROPIC_API_KEY:"fixture-never-used"},detached:true,stdio:["ignore","pipe","pipe"]});
 const capture=b=>{log=(log+b).slice(-18000);};server.stdout.on("data",capture);server.stderr.on("data",capture);
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch("http://localhost:3100/start",{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await pause(1000);}
 assert.ok(ready,"Public setup route starts");
 // Exercise real endpoint rejection paths without contacting a store or model.
 const endpoint="http://localhost:3100/api/onboarding/preview";
 for(const [body,origin,type,status] of [[{url:"http://127.0.0.1/"},true,"application/json",422],[{url:"https://store.example"},false,"application/json",403],[{url:"x".repeat(5000)},true,"application/json",413],[{},true,"text/plain",415]]){
  const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":type,...(origin?{Origin:"http://localhost:3100"}:{})},body:JSON.stringify(body)});
  assert.equal(response.status,status);
 }
 const live=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json",Origin:"http://localhost:3100"},body:JSON.stringify({url:"https://softmila.com/products/modest-wrap-cardigan"}),signal:AbortSignal.timeout(55000)});
 assert.ok([200,422].includes(live.status));
 if(live.ok){const data=await live.json();assert.ok(data.title);assert.ok(!data.photo||data.photo.startsWith("data:image/webp;base64,"));console.log("LIVE_PRODUCT_PREVIEW",JSON.stringify({status:live.status,title:data.title,thumbnail:!!data.photo}));}
 else console.log("LIVE_PRODUCT_PREVIEW store blocked metadata; optional preview fallback applies");
 browser=await chromium.launch({headless:true});
 const jpeg=await readFile("public/reels/softmila-cardigan.jpg"),photo="data:image/jpeg;base64,"+jpeg.toString("base64");
 for(const [width,locale,theme] of [[390,"en","light"],[1440,"en","dark"],[390,"ar","light"]]){
  const context=await browser.newContext({viewport:{width,height:1000},locale:"en-US",reducedMotion:"reduce"});
  const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
  let previewFails=false,paidPosts=0,otpNext=null;
  page.on("request",r=>{if(r.method()==="POST"&&new URL(r.url()).pathname.startsWith("/dashboard/"))paidPosts++;});
  await page.route("**/api/onboarding/preview",route=>route.fulfill(previewFails?{status:422}:{status:200,contentType:"application/json",body:JSON.stringify({url:"https://store.example/products/cardigan",title:"Example cardigan",photo})}));
  const prefix=locale==="en"?"":"/"+locale;
  // Existing and first-time controls: signup CTAs go to the guide, while video
  // defaults are ready without forcing advanced settings.
  await page.goto("http://localhost:3100"+prefix+"/onboarding-controls-preview",{waitUntil:"networkidle",timeout:90000});
  const action=await page.locator("[data-public-form] form").getAttribute("action");
  assert.equal(action,prefix+"/start");
  const controls=page.locator("[data-guided-controls]");
  assert.equal(await controls.locator('form input[name="kind"]').inputValue(),"video");
  assert.equal(await controls.locator("details").getAttribute("open"),null);
  assert.equal(await controls.locator('form input[name="length"]:checked').inputValue(),"7");
  // Blocked previews remain an optional aid, never a signup dead end.
  previewFails=true;
  await page.goto("http://localhost:3100"+prefix+"/start?"+new URLSearchParams({url:"https://store.example/blocked"}),{waitUntil:"networkidle"});
  await page.locator('[data-preview-state="error"]').waitFor();
  assert.equal(await page.locator("[data-continue-account]").isEnabled(),true);
  previewFails=false;
  await page.goto("http://localhost:3100"+prefix+"/start",{waitUntil:"networkidle"});
  await page.locator("#setup-url").fill("javascript:alert(1)");
  await page.locator("form button[type=submit]").click();
  assert.equal(await page.locator('[data-onboarding-step="1"] [role="alert"]').count(),1);
  await page.locator("#setup-url").fill("store.example/products/cardigan?variant=42");
  await page.locator("form button[type=submit]").click();
  await page.locator('[data-onboarding-step="2"]').waitFor();
  await page.locator('input[name="kind"][value="video"]').check();
  await page.locator('[data-preview-state="ready"] img').waitFor();
  await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  if(locale==="en"){
   const b=await page.screenshot({type:"jpeg",quality:75}),data=b.toString("base64"),name=theme+"-"+width;
   for(let i=0;i<data.length;i+=4000)console.log("ONBOARDING_IMAGE",name,i/4000,data.slice(i,i+4000));
  }
  await page.locator("[data-continue-account]").click();
  await page.waitForURL("**/login?**");
  const next=new URL(page.url()).searchParams.get("next");
  const setup=new URL(next,"http://localhost:3100");
  assert.equal(setup.pathname,"/dashboard/setup");
  assert.equal(setup.searchParams.get("kind"),"video");
  assert.equal(setup.searchParams.get("url"),"https://store.example/products/cardigan?variant=42");
  await page.locator("#email").waitFor();
  assert.equal(await page.locator('[data-account-form] ol [aria-current="step"]').count(),1);
  // An expired/missing magic-link code preserves the setup destination.
  await page.goto("http://localhost:3100/auth/callback?"+new URLSearchParams({next}),{waitUntil:"networkidle"});
  assert.equal(new URL(page.url()).searchParams.get("next"),next);
  assert.equal(new URL(page.url()).searchParams.get("error"),"link");
  const cors={"Access-Control-Allow-Origin":"http://localhost:3100","Access-Control-Allow-Headers":"*","Access-Control-Allow-Methods":"POST, OPTIONS"};
  await page.route("https://example.supabase.co/auth/v1/otp**",route=>{
   if(route.request().method()==="OPTIONS")return route.fulfill({status:204,headers:cors});
   otpNext=new URL(new URL(route.request().url()).searchParams.get("redirect_to")).searchParams.get("next");
   return route.fulfill({status:200,headers:cors,contentType:"application/json",body:"{}"});
  });
  await page.route("https://example.supabase.co/auth/v1/verify**",route=>{
   if(route.request().method()==="OPTIONS")return route.fulfill({status:204,headers:cors});
   const payload=Buffer.from(JSON.stringify({sub:"10000000-0000-4000-8000-000000000001",exp:Math.floor(Date.now()/1000)+3600,aud:"authenticated"})).toString("base64url");
   return route.fulfill({status:200,headers:cors,contentType:"application/json",body:JSON.stringify({access_token:"eyJhbGciOiJIUzI1NiJ9."+payload+".fixture",refresh_token:"fixture",token_type:"bearer",expires_in:3600,user:{id:"10000000-0000-4000-8000-000000000001",email:"fixture@example.invalid"}})});
  });
  // Successful verification must navigate to the chosen setup. Its destination
  // is fulfilled locally: no real account, message or protected mutation occurs.
  await page.route("**/dashboard/setup?**",route=>route.fulfill({status:200,contentType:"text/html",body:"<html><body>Setup handoff verified</body></html>"}));
  await page.locator("#email").fill("fixture@example.invalid");
  await page.locator("form button[type=submit]").click();
  await page.locator("#code").waitFor();
  assert.equal(otpNext,next);
  await page.locator("#code").fill("123456");
  await page.locator("form button[type=submit]").click();
  await page.waitForURL("**/dashboard/setup?**",{timeout:30000});
  assert.equal(new URL(page.url()).search,next.slice(next.indexOf("?")));
  assert.equal(paidPosts,0);
  assert.deepEqual(errors,[]);
  console.log("PASS guided setup, preview fallback, selected format and mocked email-code handoff",width,locale,theme);
  await context.close();
 }
}catch(error){console.error(log);throw error;}
finally{if(browser)await browser.close();if(server){try{process.kill(-server.pid,"SIGTERM");}catch{}}await rm(folder,{recursive:true,force:true});}
