import assert from "node:assert/strict";
import {mkdir,writeFile,readFile,rm} from "node:fs/promises";
import {spawn} from "node:child_process";
import {createRequire} from "node:module";
import {setTimeout as pause} from "node:timers/promises";
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
const folder="src/app/[locale]/choose-preview",actionFile="src/app/[locale]/dashboard/publishing/actions.ts";
let server,browser,originalAction,log="";
const ids=["82000000-0000-4000-8000-000000000001","82000000-0000-4000-8000-000000000002","82000000-0000-4000-8000-000000000003"];
try{
 originalAction=await readFile(actionFile,"utf8");
 // Local mock only: no provider, account, queue or database mutation.
 await writeFile(actionFile,"\"use server\";\nexport type PublishState={error:string|null;done:string|null};\nexport async function publishAds(_prev:PublishState,form:FormData):Promise<PublishState>{\n if(form.get(\"caption\")===\"Fixture fail\")return {error:\"Fixture publish error\",done:null};\n if(form.getAll(\"creativeIds\").length!==1||form.getAll(\"accountIds\").length!==1)return {error:\"Wrong selection\",done:null};\n return {error:null,done:\"Fixture accepted for publishing\"};\n}");
 await mkdir(folder,{recursive:true});await writeFile(folder+"/page.tsx","import {GenerationBlock} from \"@/app/[locale]/dashboard/products/[id]/generation-block\";import {ChosenAdResume} from \"@/app/[locale]/dashboard/publishing/chosen-ad-resume\";import {getMessages} from \"@/i18n/messages\";import {isLocale} from \"@/i18n/config\";\nconst ids=[\"82000000-0000-4000-8000-000000000001\",\"82000000-0000-4000-8000-000000000002\",\"82000000-0000-4000-8000-000000000003\"];\nconst ads=ids.map((id,i)=>({id,kind:\"image\" as const,aspect:i===1?\"9:16\":\"1:1\",angle:\"benefit\",headline:\"Ad \"+(i+1),primary_text:\"Caption \"+(i+1),cta:\"Shop now\"}));\nconst base={id:\"81000000-0000-4000-8000-000000000003\",type:\"image_ads\",status:\"succeeded\" as const,error:null,created_at:\"2026-10-31T12:00:00Z\",showcased_at:null,cost_credits:10,creatives:ads};\nexport default async function Preview({params}:PageProps<\"/[locale]/choose-preview\">){\n const {locale}=await params;if(!isLocale(locale))return null;const t=await getMessages(locale);\n const props={t,locale,imageVersion:\"fixture\",canShowcase:false,productUrl:\"https://store.example/item\",productId:\"81000000-0000-4000-8000-000000000002\",workspaceId:\"81000000-0000-4000-8000-000000000001\",nextSlot:\"Tomorrow\",posts:{},canRetry:true};\n return <main className=\"mx-auto max-w-5xl p-4\"><ChosenAdResume workspaceId={props.workspaceId} connected/>\n <section data-connected><GenerationBlock {...props} generation={base} accounts={[{id:\"account-fixture\",platform:\"facebook\",name:\"My store\"}]}/></section>\n <section data-disconnected className=\"mt-10\"><GenerationBlock {...props} generation={{...base,id:\"81000000-0000-4000-8000-000000000004\"}} accounts={[]}/></section>\n <section data-viewer className=\"mt-10\"><GenerationBlock {...props} generation={{...base,id:\"81000000-0000-4000-8000-000000000005\"}} accounts={[{id:\"account-fixture\",platform:\"facebook\",name:\"My store\"}]} canRetry={false}/></section></main>;\n}");
 server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","-p","3100"],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture",ANTHROPIC_API_KEY:"fixture-never-used"},detached:true,stdio:["ignore","pipe","pipe"]});
 const capture=b=>{log=(log+b).slice(-14000);};server.stdout.on("data",capture);server.stderr.on("data",capture);
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch("http://localhost:3100/choose-preview",{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await pause(1000);}assert.ok(ready);
 browser=await chromium.launch({headless:true});const jpeg=await readFile("public/reels/softmila-cardigan.jpg");
 for(const [width,locale,theme] of [[320,"en","light"],[390,"en","light"],[1440,"en","dark"],[390,"ar","light"]]){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:"reduce"});
  const page=await context.newPage(),errors=[],images=[],unsafe=[];let posts=0;
  page.on("pageerror",e=>errors.push(e.message));
  page.on("request",r=>{const u=new URL(r.url());if(r.method()==="POST")posts++;if(["supabase.co","stripe.com","zernio.com"].some(host=>u.hostname.endsWith(host))||["/api/social","/api/stripe","/api/generations"].some(p=>u.pathname.startsWith(p)))unsafe.push(r.url());if(u.pathname.endsWith("/image"))images.push(u);});
  await page.route("**/api/creatives/**",route=>route.fulfill({status:200,contentType:"image/jpeg",body:jpeg}));
  const url="http://localhost:3100"+(locale==="en"?"":"/"+locale)+"/choose-preview";
  await page.goto(url,{waitUntil:"networkidle",timeout:90000});
  await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
  const card=page.locator("[data-connected]"),gallery=card.locator("[data-ad-gallery]"),dialog=card.locator("dialog");
  assert.equal(await page.locator("[data-chosen-ad-resume]").count(),0);
  assert.equal(await page.locator("[data-viewer] dialog").count(),0);
  assert.equal(await gallery.locator("[data-ad-choices] button").count(),3);
  await gallery.locator("[data-ad-choices] button").nth(1).click();
  assert.equal(await gallery.locator('[aria-pressed="true"]').count(),1);
  assert.ok((await gallery.locator("[data-selected-preview] img").getAttribute("src")).includes(ids[1]));
  assert.equal(await gallery.locator("[data-selected-preview] img").evaluate(el=>getComputedStyle(el).objectFit),"contain");
  assert.equal(posts,0);
  await gallery.locator("button.btn-primary").click();await dialog.locator("form").waitFor({state:"visible"});
  assert.ok((await dialog.locator("[data-publish-preview] img").getAttribute("src")).includes(ids[1]));
  const data=await dialog.locator("form").evaluate(f=>{const d=new FormData(f);return {ids:d.getAll("creativeIds"),accounts:d.getAll("accountIds"),when:d.get("when"),caption:d.get("caption")};});
  assert.deepEqual(data.ids,[ids[1]]);assert.deepEqual(data.accounts,["account-fixture"]);assert.equal(data.when,"now");assert.equal(data.caption,"Caption 2\n\nhttps://store.example/item");
  assert.equal(await dialog.locator("details").getAttribute("open"),null);
  await page.keyboard.press("Escape");assert.equal(await dialog.evaluate(d=>d.open),false);
  assert.equal(await gallery.locator("button.btn-primary").evaluate(el=>el===document.activeElement),true);
  await page.goto(url+"?favorite="+ids[1],{waitUntil:"networkidle"});
  await page.locator("[data-chosen-ad-resume]").waitFor();
  assert.ok((await page.locator("[data-chosen-ad-resume] a").getAttribute("href")).startsWith("/dashboard/products/81000000-0000-4000-8000-000000000002?favorite="+ids[1]));
  assert.ok((await gallery.locator("[data-selected-preview] img").getAttribute("src")).includes(ids[1]));
  assert.equal(await dialog.evaluate(d=>d.open),false);assert.equal(posts,0);
  await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
  if(width===390&&locale==="en"){const b=(await gallery.screenshot({type:"jpeg",quality:75})).toString("base64");for(let i=0;i<b.length;i+=4000)console.log("CHOICE_IMAGE",i/4000,b.slice(i,i+4000));}
  await gallery.locator("button.btn-primary").click();
  await dialog.locator('textarea[name="caption"]').fill("Fixture fail");
  await dialog.locator('button[type="submit"]').click();await dialog.locator('[role="alert"]').waitFor();
  assert.equal(await dialog.locator('[role="alert"]').textContent(),"Fixture publish error");assert.equal(await dialog.locator('button[type="submit"]').isEnabled(),true);
  await dialog.locator('textarea[name="caption"]').fill("Updated caption");
  await dialog.locator('button[type="submit"]').click();await dialog.locator('[role="status"]').waitFor();
  assert.ok((await dialog.locator('[role="status"]').innerText()).includes("Fixture accepted"));
  assert.equal(await dialog.locator('button[type="submit"]').isDisabled(),true);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem("gooidy:ad-choice:v1")),null);assert.equal(posts,2);
  await page.keyboard.press("Escape");
  const disconnected=page.locator("[data-disconnected]");await disconnected.locator("[data-ad-choices] button").nth(2).click();await disconnected.locator("[data-ad-gallery] button.btn-primary").click();
  assert.equal(await disconnected.locator("dialog form").count(),0);
  assert.equal(await disconnected.locator('dialog a[href="/dashboard/publishing"]').count(),1);
  assert.ok((await disconnected.locator("dialog [data-publish-preview] img").getAttribute("src")).includes(ids[2]));
  await page.keyboard.press("Escape");
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.ok(images.every(u=>u.searchParams.get("preview")==="1"));assert.deepEqual(unsafe,[]);assert.deepEqual(errors,[]);
  console.log("PASS chosen preview, tab-local connection resume, explicit mock confirmation, retry, duplicate submit and layout",width,locale,theme);
  await context.close();
 }
}catch(error){console.error(log);throw error;}
finally{if(browser)await browser.close();if(server){try{process.kill(-server.pid,"SIGTERM");}catch{}}await rm(folder,{recursive:true,force:true});if(originalAction!==undefined)await writeFile(actionFile,originalAction);}
