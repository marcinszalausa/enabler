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
 const raw=await(await fetch("http://localhost:3126/pricing")).text();for(const phrase of ["Everything in Launch, plus:","Need more credits?","Every plan covers the whole journey","What if I run out of credits?"])assert.ok(raw.includes(phrase),"Server HTML contains "+phrase);
 const match=raw.match(/<script\b[^>]*data-pricing-structured[^>]*>([\s\S]*?)<\/script>/);assert.ok(match,"JSON-LD is server-rendered");const data=JSON.parse(match[1]);assert.equal(data["@type"],"FAQPage");assert.ok(!JSON.stringify(data).includes('"offers"'));
 const polish=await(await fetch("http://localhost:3126/pl/pricing")).text();assert.ok(polish.includes("Cennik")&&polish.includes("Wszystko z Launch, a do tego:"),"Pricing is translated");
 browser=await chromium.launch({headless:true});
 for(const [width,locale]of [[320,"en"],[390,"en"],[390,"ja"],[1440,"en"]]){
  const page=await browser.newPage({viewport:{width,height:950},reducedMotion:"reduce"});const errors=[];page.on("pageerror",e=>errors.push(e.message));await page.goto("http://localhost:3126"+(locale==="en"?"":"/"+locale)+"/pricing",{waitUntil:"networkidle"});
  assert.equal(await page.locator("button[data-buy-plan]:disabled").count(),3);assert.equal(await page.locator("a[data-buy-plan],button[data-buy-plan]:enabled").count(),0);assert.equal(await page.locator("[data-plan]").count(),3);
  for(const id of ["starter","plus","growth"])assert.ok(await page.locator(`[data-plan-included="${id}"] li`).count()>=4,id+" explains its key benefits");
  if(locale==="en"){const plus=page.locator('[data-plan="plus"]'),growth=page.locator('[data-plan="growth"]');assert.match(await plus.innerText(),/Everything in Launch, plus/);assert.match(await growth.innerText(),/Everything in Grow, plus/);assert.match(await growth.innerText(),/30 recent posts/);assert.match(await page.locator('[data-plan="starter"]').innerText(),/One social account included/);assert.match(await page.locator('[data-plan="starter"]').innerText(),/Soon/);}
  for(const [id,month,year] of [["starter","39","31.2"],["plus","69","55.2"],["growth","99","79.2"]]){assert.equal(await page.locator(`[data-plan="${id}"] [data-price]`).getAttribute("data-price"),month);}
  await page.locator("[data-billing-toggle] button").nth(1).click();
  for(const [id,year] of [["starter","31.2"],["plus","55.2"],["growth","79.2"]])assert.equal(await page.locator(`[data-plan="${id}"] [data-price]`).getAttribute("data-price"),year);
  assert.equal(await page.locator('[data-plan="free"]').count(),0);
  if(width>=1440){const tops=await page.locator("[data-plan]").evaluateAll(cards=>cards.map(card=>Math.round(card.getBoundingClientRect().top)));assert.equal(new Set(tops).size,1,"Plans sit in one row on desktop");}
  const questions=await page.locator("[data-pricing-faq] summary").allTextContents();const answers=await page.locator("[data-pricing-faq] details p").allTextContents();const faq=JSON.parse(await page.locator("script[data-pricing-structured]").textContent());assert.deepEqual(faq.mainEntity.map(q=>q.name),questions);assert.deepEqual(faq.mainEntity.map(q=>q.acceptedAnswer.text),answers);
  assert.equal(await page.locator("[data-pack]").count(),2);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"No page overflow");
  assert.deepEqual(errors,[]);console.log("PASS plan cards, yearly toggle, FAQ schema and responsive layout",width,locale);await page.close();
 }
 for(const plan of ["starter","plus","growth"]){
  const page=await browser.newPage({viewport:{width:390,height:950}});
  await page.route("**/api/onboarding/preview",route=>route.fulfill({json:{url:"https://example.invalid/product",title:"Your product",photo:null}}));
  await page.goto("http://localhost:3126/pricing",{waitUntil:"networkidle"});
  assert.equal(await page.locator('[data-recommended-plan]').count(),1);assert.equal(await page.locator('[data-plan="plus"] [data-recommended-plan]').count(),1);
  assert.equal(await page.locator('[data-plan] del,[data-plan] s').count(),0);
  await page.goto("http://localhost:3126/checkout?plan="+plan,{waitUntil:"networkidle"});
  await page.locator('[data-purchase-plan="'+plan+'"]').waitFor();assert.match(await page.locator("h1").innerText(),new RegExp({starter:"Launch",plus:"Grow",growth:"Scale"}[plan]));assert.equal(await page.locator("[data-purchase-unavailable]").count(),1);assert.equal(await page.locator("[data-onboarding-step]").count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"Purchase summary fits mobile");
  await page.goto("http://localhost:3126/pricing",{waitUntil:"networkidle"});assert.equal(await page.locator('[data-try-plan="'+plan+'"]').innerText(),"Explore first");
  await page.locator('[data-try-plan="'+plan+'"]').click();await page.waitForURL(u=>u.pathname==="/start"&&u.searchParams.get("plan")===plan);
  await page.locator('[data-selected-plan="'+plan+'"]').waitFor();await page.locator('input[name="url"]').fill("https://example.invalid/product");await page.locator('form button[type="submit"]').click();
  await page.locator('[data-onboarding-step="2"]').waitFor();await page.locator('input[value="video"]').check();assert.equal(new URL(page.url()).searchParams.get("plan"),plan);
  await page.locator('[data-continue-account]').click();await page.waitForURL(u=>u.pathname==="/login");
  const next=new URL(new URL(page.url()).searchParams.get("next"),"https://gooidy.com");assert.equal(next.pathname,"/dashboard/setup");assert.equal(next.searchParams.get("plan"),plan);assert.equal(next.searchParams.get("kind"),"video");assert.equal(next.searchParams.get("url"),"https://example.invalid/product");
  console.log("PASS selected plan survives optional free preview to login",plan);await page.close();
 }
 const home=await browser.newPage({viewport:{width:390,height:950},javaScriptEnabled:false});await home.goto("http://localhost:3126/",{waitUntil:"domcontentloaded"});
 assert.equal(await home.locator("#pricing [data-plan-included]").count(),3);assert.equal(await home.locator("#pricing button[data-buy-plan]:disabled").count(),3);assert.equal(await home.locator("#pricing a[data-try-plan]").count(),3);
 assert.ok(await home.locator('#pricing [data-plan-included="starter"] li').count()>=4);assert.ok(await home.locator('#pricing [data-plan-included="growth"] li').count()>=4);await home.close();console.log("PASS plan cards on homepage without JavaScript");
 console.log("PASS raw HTML content is readable without JavaScript");
}catch(error){console.error(log);throw error;}finally{await browser?.close();if(server?.pid)try{process.kill(-server.pid,"SIGTERM");}catch{}}
