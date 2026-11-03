import assert from "node:assert/strict";
import {mkdir,writeFile,rm} from "node:fs/promises";
import {spawn} from "node:child_process";
import {createRequire} from "node:module";
import {setTimeout as pause} from "node:timers/promises";
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
const folder="src/app/[locale]/personalization-preview";
let server,browser,log="";
try{
 await mkdir(folder,{recursive:true});
 await writeFile(folder+"/page.tsx", 'import {PersonalizationForm} from "@/app/[locale]/dashboard/products/[id]/personalization-form"; export default function Preview(){return <main className="mx-auto max-w-4xl p-4"><div data-required><PersonalizationForm productId="fixture" initial={null} audience="People seeking comfortable everyday clothing" focus="Soft fabric for relaxed mornings" benefits={["Soft fabric for relaxed mornings","Easy everyday care","Room to move"]} required/></div><div data-saved><PersonalizationForm productId="saved" initial={{promotion:"collection",audience:"Returning shoppers",focus:"Matching pieces",offer:""}} audience="Source audience" focus="Source benefit"/></div></main>;}');
 server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","-p","3100"],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture",ANTHROPIC_API_KEY:"fixture-never-used"},detached:true,stdio:["ignore","pipe","pipe"]});
 const capture=b=>{log=(log+b).slice(-12000);};server.stdout.on("data",capture);server.stderr.on("data",capture);
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch("http://localhost:3100/personalization-preview",{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await pause(1000);}assert.ok(ready);
 browser=await chromium.launch({headless:true});
 for(const [width,locale,theme] of [[320,"en","light"],[390,"en","light"],[1440,"en","dark"],[390,"ar","light"]]){
  const context=await browser.newContext({viewport:{width,height:1100},reducedMotion:"reduce"});
  const page=await context.newPage(),errors=[];let posts=0;
  page.on("pageerror",e=>errors.push(e.message));page.on("request",r=>{if(r.method()==="POST")posts++;});
  await page.goto("http://localhost:3100"+(locale==="en"?"":"/"+locale)+"/personalization-preview",{waitUntil:"networkidle",timeout:90000});
  await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
  const required=page.locator("[data-required]"),form=required.locator("form");
  assert.equal(await required.locator("details").getAttribute("open"),"");
  assert.equal(await form.locator('[name="audience"]').inputValue(),"People seeking comfortable everyday clothing");
  assert.equal(await form.locator('[name="focus"]').inputValue(),"Soft fabric for relaxed mornings");
  assert.equal(await form.locator('input[name="promotion"]:checked').inputValue(),"product");
  assert.equal(await form.locator('[name="audience"]').getAttribute("maxlength"),"240");
  await form.locator('input[value="offer"]').check();
  assert.equal(await form.evaluate(f=>f.checkValidity()),false);
  await form.locator('textarea[name="offer"]').fill("10% off through Sunday; selected items");
  assert.equal(await form.evaluate(f=>f.checkValidity()),true);
  await form.locator('input[value="product"]').check();
  assert.equal(await form.locator('[name="offer"]').inputValue(),"");
  await form.locator('input[value="offer"]').check();
  assert.equal(await form.locator('[name="offer"]').inputValue(),"10% off through Sunday; selected items");
  const choices=form.locator("[data-benefit-choices] button");
  assert.equal(await choices.count(),3);
  await choices.nth(1).click();
  assert.equal(await form.locator('[name="focus"]').inputValue(),"Easy everyday care");
  assert.equal(await choices.nth(1).getAttribute("aria-pressed"),"true");
  assert.ok((await form.locator("[data-direction-preview]").innerText()).includes("Easy everyday care"));
  await form.locator('[name="focus"]').fill("My own message");
  assert.equal(await choices.nth(1).getAttribute("aria-pressed"),"false");
  assert.ok((await form.locator("[data-direction-preview]").innerText()).includes("My own message"));
  assert.ok((await form.locator("[data-direction-preview]").innerText()).includes("10% off"));
  assert.equal(await form.locator('input[name="promotion"]').count(),3);
  assert.equal(await form.locator('fieldset').first().locator("svg").count(),3);
  const data=await form.evaluate(f=>{const d=new FormData(f);return Object.fromEntries(["promotion","audience","focus","offer"].map(k=>[k,d.get(k)]));});
  assert.equal(data.promotion,"offer");assert.ok(data.offer.startsWith("10%"));
  const saved=page.locator("[data-saved]");
  assert.equal(await saved.locator("details").getAttribute("open"),null);
  await saved.locator("summary").click();
  assert.equal(await saved.locator('[name="audience"]').inputValue(),"Returning shoppers");
  assert.equal(await saved.locator('input[name="promotion"]:checked').inputValue(),"collection");
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.equal(posts,0);assert.deepEqual(errors,[]);
  if(width===390&&locale==="en"){
   const data=(await required.screenshot({type:"jpeg",quality:75})).toString("base64");
   for(let i=0;i<data.length;i+=4000)console.log("VISUAL_PREF_IMAGE",i/4000,data.slice(i,i+4000));
  }
  console.log("PASS visual choices, live message preview, prefilled preferences, conditional offer, saved choices and layout",width,locale,theme);
  await context.close();
 }
}catch(error){console.error(log);throw error;}
finally{if(browser)await browser.close();if(server){try{process.kill(-server.pid,"SIGTERM");}catch{}}await rm(folder,{recursive:true,force:true});}
