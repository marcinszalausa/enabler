import assert from "node:assert/strict";
import {mkdir,writeFile,rm} from "node:fs/promises";
import {spawn} from "node:child_process";
import {createRequire} from "node:module";
import {setTimeout as pause} from "node:timers/promises";
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH),folder="src/app/[locale]/catalog-photo-preview";
let server,browser,log="";
try{
 await mkdir(folder,{recursive:true});
 await writeFile(folder+"/page.tsx",`import {PhotoReview} from "@/app/[locale]/dashboard/stores/products/[id]/photo-review";
const photo="data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="400"><rect width="240" height="400" fill="#a3b3a4"/><circle cx="120" cy="70" r="40" fill="#e6d5c2"/></svg>');
export default function Page(){return <main className="mx-auto max-w-5xl px-4 py-8"><h1>Product photos</h1><PhotoReview itemId="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" images={[photo,photo,photo,photo]}/><PhotoReview itemId="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" images={[]}/></main>}`);
 server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","-p","3131"],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture"},detached:true,stdio:["ignore","pipe","pipe"]});
 const capture=b=>{log=(log+b).slice(-12000);};server.stdout.on("data",capture);server.stderr.on("data",capture);
 let ready=false;for(let i=0;i<90;i++){try{if((await fetch("http://localhost:3131/catalog-photo-preview",{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await pause(1000);}assert.ok(ready);
 browser=await chromium.launch({headless:true});
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on("pageerror",e=>errors.push(e.message));let mode="report",calls=0;
  await page.route("**/api/catalog/photos/check",async route=>{calls++;assert.deepEqual(route.request().postDataJSON(),{itemId:"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"});await pause(250);if(mode==="stale")return route.fulfill({status:409,json:{code:"PHOTOS_CHANGED"}});return route.fulfill({json:{report:{usable:1,minimum:10,ready:false,complete:true,photos:[{index:0,status:"usable",width:1024,height:1536},{index:1,status:"small",width:200,height:300},{index:2,status:"duplicate"},{index:3,status:"unreadable"}]}}});});
  await page.goto("http://localhost:3131/catalog-photo-preview",{waitUntil:"networkidle"});const section=page.locator("[data-catalog-photo-review]").first(),button=section.getByRole("button");
  assert.equal(calls,0,"No checks run automatically");assert.equal(await page.locator("[data-catalog-photo-review]").nth(1).getByRole("button").isDisabled(),true);
  await button.click();assert.equal(await button.isDisabled(),true);await section.locator("[data-photo-summary]").waitFor();assert.match(await section.innerText(),/Suitable photos: 1 · Minimum: 10/);assert.match(await section.innerText(),/9 more suitable photos/);
  assert.deepEqual(await section.locator("[data-photo-verdict]").allTextContents(),["Meets size and uniqueness checks","Too small · use a larger original","Duplicate or very similar photo","Couldn’t read this photo"]);
  const fit=await section.locator("img").first().evaluate(img=>getComputedStyle(img).objectFit);assert.equal(fit,"contain","Full photo stays visible");
  mode="stale";await button.click();await section.getByText(/store photos changed/i).waitFor();assert.equal(await section.locator("[data-photo-summary]").count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"No horizontal overflow");assert.deepEqual(errors,[]);console.log("PASS photo checks, pending and stale states, full photo and responsive layout",width);await page.close();
 }
}catch(error){console.error(log);throw error;}finally{await browser?.close();if(server?.pid)try{process.kill(-server.pid,"SIGTERM");}catch{}await rm(folder,{recursive:true,force:true});}
