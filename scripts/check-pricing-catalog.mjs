import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createRequire} from "node:module";
import {setTimeout as pause} from "node:timers/promises";
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
let browser,server,log="";
try{
 server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","-p","3126"],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture"},detached:true,stdio:["ignore","pipe","pipe"]});
 const capture=b=>{log=(log+b).slice(-14000);};server.stdout.on("data",capture);server.stderr.on("data",capture);
 let ready=false;for(let i=0;i<90;i++){try{if((await fetch("http://localhost:3126/pricing",{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await pause(1000);}assert.ok(ready);
 const raw=await(await fetch("http://localhost:3126/pricing")).text();for(const phrase of ["Every plan, feature by feature","Weekly planning preview","Matching-network post comparisons","How do the reporting tools differ?"])assert.ok(raw.includes(phrase),"Server HTML contains "+phrase);
 const match=raw.match(/<script\b[^>]*data-pricing-structured[^>]*>([\s\S]*?)<\/script>/);assert.ok(match,"JSON-LD is server-rendered");const data=JSON.parse(match[1]);assert.equal(data["@graph"].find(n=>n["@type"]==="ItemList").itemListElement.length,3);assert.ok(!JSON.stringify(data).includes('"offers"'));
 browser=await chromium.launch({headless:true});
 const plain=await browser.newPage({javaScriptEnabled:false});await plain.goto("http://localhost:3126/pricing",{waitUntil:"domcontentloaded"});assert.equal(await plain.locator("[data-plan-details] dt").count(),96,"All feature entries exist without JavaScript");assert.equal(await plain.locator("[data-pricing-faq] details").count(),11);await plain.close();
 for(const [width,locale]of [[320,"en"],[390,"en"],[390,"ar"],[1440,"en"]]){
  const page=await browser.newPage({viewport:{width,height:950},reducedMotion:"reduce"});const errors=[];page.on("pageerror",e=>errors.push(e.message));await page.goto("http://localhost:3126"+(locale==="en"?"":"/"+locale)+"/pricing",{waitUntil:"networkidle"});
  assert.equal(await page.locator("button[data-buy-plan]:disabled").count(),3);assert.equal(await page.locator("a[data-buy-plan]").count(),0);assert.equal(await page.locator("[data-plan]").count(),3);assert.equal(await page.locator("[data-plan-details]").count(),3);for(const p of ["starter","plus","growth"])assert.equal(await page.locator(`[data-plan-details="${p}"] dt`).count(),32);
  const starter=page.locator('[data-plan-included="starter"]');assert.equal(await starter.locator("li").count(),5);
  for(const feature of ["300 generation credits every month","Image and video ads in your brand","One social account included","Free text edits and ad downloads","Weekly planner and scheduled posts"])assert.ok((await starter.innerText()).includes(feature));
  const shared=page.locator("[data-shared-plan-features]");assert.equal(await shared.count(),1);assert.equal(await shared.getByRole("heading",{name:"Included in every paid plan"}).count(),1);assert.equal(await shared.locator("li").count(),6);assert.ok(await shared.evaluate(el=>!el.closest("[data-plan]")),"Common panel is outside the cards");assert.ok(await shared.evaluate(el=>!!(el.compareDocumentPosition(document.querySelector("#plan-free"))&Node.DOCUMENT_POSITION_FOLLOWING)),"Shared benefits appear before optional preview details");
  const heights=await page.locator("[data-plan]").evaluateAll(cards=>cards.map(card=>card.getBoundingClientRect().height));assert.ok(Math.max(...heights)-Math.min(...heights)<=2,"Cards have balanced heights at "+width+" "+locale);
  const plus=page.locator('[data-plan="plus"]'),growth=page.locator('[data-plan="growth"]');
  assert.match(await plus.innerText(),/Everything in Starter, plus/);assert.match(await growth.innerText(),/Everything in Plus, plus/);
  assert.equal(await plus.locator("[data-plan-included] li").count(),5);assert.equal(await growth.locator("[data-plan-included] li").count(),5);
  assert.match(await growth.innerText(),/Growth-only next-test action plan/);assert.match(await growth.innerText(),/Download your next-campaign brief/);assert.ok(!(await plus.innerText()).includes("Growth-only next-test action plan"));assert.match(await plus.innerText(),/Filter results by social network/);
  for(const card of [plus,growth])for(const repeated of ["Product-page import and brand brief","Saved logo, colors, font and brand voice","One social account included","Weekly planner and calendar reminders"])assert.ok(!(await card.innerText()).includes(repeated),"Inherited features are not repeated");
  assert.match(await page.locator('[data-plan-details="starter"]').innerText(),/Not included — Plus and Growth/);assert.match(await page.locator('[data-plan-details="growth"]').innerText(),/Up to 30/);
  const questions=await page.locator("[data-pricing-faq] summary").allTextContents();const answers=await page.locator("[data-pricing-faq] details p").allTextContents();const faq=JSON.parse(await page.locator("script[data-pricing-structured]").textContent())["@graph"].find(n=>n["@type"]==="FAQPage");assert.deepEqual(faq.mainEntity.map(q=>q.name),questions);assert.deepEqual(faq.mainEntity.map(q=>q.acceptedAnswer.text),answers);
  await page.getByRole("navigation",{name:"Jump to full plan details"}).getByRole("link",{name:"growth details ↓"}).click();const box=await page.locator("#details-growth").boundingBox(),header=await page.locator("header").first().boundingBox();assert.ok(box.y>=header.y+header.height-1,"Jump clears sticky navigation");assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"No page overflow");
  if(width===1440){await page.evaluate(()=>scrollTo(0,document.querySelector("[data-public-plans]").getBoundingClientRect().top+scrollY-80));console.log("PLAN_INCLUSIONS_PREVIEW",(await page.screenshot({type:"jpeg",quality:70})).toString("base64"));}if(width===390&&locale==="en")console.log("CATALOG_PREVIEW",(await page.screenshot({type:"jpeg",quality:70})).toString("base64"));assert.deepEqual(errors,[]);console.log("PASS full pricing lists, FAQ schema and responsive anchors",width,locale);await page.close();
 }
 for(const plan of ["starter","plus","growth"]){
  const page=await browser.newPage({viewport:{width:390,height:950}});
  await page.route("**/api/onboarding/preview",route=>route.fulfill({json:{url:"https://example.invalid/product",title:"Your product",photo:null}}));
  await page.goto("http://localhost:3126/pricing",{waitUntil:"networkidle"});
  assert.equal(await page.locator('[data-recommended-plan]').count(),1);assert.equal(await page.locator('[data-plan="plus"] [data-recommended-plan]').innerText(),"Recommended");
  assert.equal(await page.locator('[data-plan] del,[data-plan] s').count(),0);
  const buys=page.locator('[data-buy-plan="'+plan+'"]');assert.match(await buys.innerText(),/^Buy /);
  assert.equal(await buys.isDisabled(),true);assert.equal(await buys.getAttribute("href"),null);
  const before=page.url();await buys.evaluate(el=>el.click());assert.equal(page.url(),before,"Disabled Buy never navigates");
  assert.match(await page.locator("#purchase-status").innerText(),/Purchases are currently unavailable/);
  await page.goto("http://localhost:3126/checkout?plan="+plan,{waitUntil:"networkidle"});
  await page.locator('[data-purchase-plan="'+plan+'"]').waitFor();assert.match(await page.locator("h1").innerText(),new RegExp(plan,"i"));assert.equal(await page.locator("[data-purchase-unavailable]").count(),1);assert.equal(await page.locator("[data-onboarding-step]").count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"Purchase summary fits mobile");
  await page.goto("http://localhost:3126/pricing",{waitUntil:"networkidle"});assert.equal(await page.locator('[data-try-plan="'+plan+'"]').innerText(),"Try for free");
  await page.locator('[data-try-plan="'+plan+'"]').click();await page.waitForURL(u=>u.pathname==="/start"&&u.searchParams.get("plan")===plan);
  await page.locator('[data-selected-plan="'+plan+'"]').waitFor();await page.locator('input[name="url"]').fill("https://example.invalid/product");await page.locator('form button[type="submit"]').click();
  await page.locator('[data-onboarding-step="2"]').waitFor();await page.locator('input[value="video"]').check();assert.equal(new URL(page.url()).searchParams.get("plan"),plan);
  await page.locator('[data-continue-account]').click();await page.waitForURL(u=>u.pathname==="/login");
  const next=new URL(new URL(page.url()).searchParams.get("next"),"https://gooidy.com");assert.equal(next.pathname,"/dashboard/setup");assert.equal(next.searchParams.get("plan"),plan);assert.equal(next.searchParams.get("kind"),"video");assert.equal(next.searchParams.get("url"),"https://example.invalid/product");
  console.log("PASS selected plan survives optional free preview to login",plan);await page.close();
 }
 const home=await browser.newPage({viewport:{width:390,height:950},javaScriptEnabled:false});await home.goto("http://localhost:3126/",{waitUntil:"domcontentloaded"});
 assert.equal(await home.locator("#pricing [data-plan-included]").count(),3);assert.equal(await home.locator("#pricing button[data-buy-plan]:disabled").count(),3);assert.equal(await home.locator("#pricing a[data-try-plan]").count(),3);
 assert.equal(await home.locator('#pricing [data-plan-included="starter"] li').count(),5);assert.equal(await home.locator('#pricing [data-plan-included="plus"] li').count(),5);assert.equal(await home.locator('#pricing [data-plan-included="growth"] li').count(),5);
 assert.equal(await home.locator("#pricing [data-shared-plan-features] li").count(),6);await home.close();console.log("PASS inherited plan lists on homepage without JavaScript; Buy remains disabled");
 console.log("PASS raw HTML content is readable without JavaScript");
}catch(error){console.error(log);throw error;}finally{await browser?.close();if(server?.pid)try{process.kill(-server.pid,"SIGTERM");}catch{}}
