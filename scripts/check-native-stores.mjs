import assert from "node:assert/strict";
import {mkdir,writeFile,rm} from "node:fs/promises";
import {spawn} from "node:child_process";
import {createRequire} from "node:module";
import {setTimeout as pause} from "node:timers/promises";
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH),folder="src/app/[locale]/native-stores-preview";
let browser,server,log="";
try{
 await mkdir(folder,{recursive:true});
 await writeFile(folder+"/page.tsx",[
 'import {Suspense} from "react";import {StoreUpgradeCard,PlatformConnectCards,PlatformConnectionCard} from "@/app/[locale]/dashboard/stores/platform-view";',
 'export default function Page({searchParams}:{searchParams:Promise<Record<string,string>>}){return <Suspense fallback={<p>Loading</p>}><Content searchParams={searchParams}/></Suspense>}',
 'async function Content({searchParams}:{searchParams:Promise<Record<string,string>>}){const p=await searchParams,allowed=p.mode!=="basic",owner=p.mode!=="viewer";return <main className="landing mx-auto max-w-5xl px-4 py-8"><h1>Your stores</h1>{allowed?<PlatformConnectCards workspaceId="fixture" owner={owner} availability={{woocommerce:p.mode!=="disabled",wix:p.mode!=="disabled",squarespace:p.mode!=="disabled",bigcommerce:p.mode!=="disabled"}}/>:<StoreUpgradeCard/>}<div className="mt-6"><PlatformConnectionCard workspaceId="fixture" owner={owner} allowed={allowed} ready={true} store={{id:"fixture",provider:"woocommerce",name:"Soft Mila",store_url:"https://store.example",status:"connected"}}/></div></main>}'
 ].join("\n"));
 server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","-p","3117"],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture"},detached:true,stdio:["ignore","pipe","pipe"]});
 const capture=b=>{log=(log+b).slice(-12000);};server.stdout.on("data",capture);server.stderr.on("data",capture);
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch("http://localhost:3117/native-stores-preview",{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await pause(1000);}assert.ok(ready,"Preview ready");
 browser=await chromium.launch({headless:true});
 for(const width of [320,390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:"reduce"}),errors=[];page.on("pageerror",e=>errors.push(e.message));
  for(const mode of ["grow","basic","disabled","viewer"]){
   await page.goto("http://localhost:3117/native-stores-preview?mode="+mode,{waitUntil:"networkidle",timeout:90000});
   if(mode==="basic"){
    assert.equal(await page.locator("[data-native-platforms]").count(),0);assert.equal(await page.locator("[data-store-upgrade]").count(),1);
    assert.equal(await page.getByRole("button",{name:"Refresh products"}).isDisabled(),true);
    assert.equal(await page.locator('[data-store-upgrade] a[href="/dashboard/billing"]').count(),1);
   }else for(const [provider,name] of [["woocommerce","WooCommerce"],["wix","Wix"],["squarespace","Squarespace"],["bigcommerce","BigCommerce"]]){
    const card=page.locator('[data-platform="'+provider+'"]'),button=card.getByRole("button",{name:"Connect "+name});
    if(mode==="viewer"){assert.equal(await button.count(),0);continue;}
    assert.equal(await button.isDisabled(),mode==="disabled");assert.ok((await button.boundingBox()).height>=44);
    assert.equal(await card.locator("form").getAttribute("action"),"/api/stores/"+provider+"/connect");
    assert.equal(await card.locator('input[name="storeUrl"]').count(),["wix","squarespace"].includes(provider)?0:1);
   }
   if(mode!=="viewer"){const row=page.locator("[data-native-store]");await row.locator("summary").click();assert.equal(await row.getByRole("button",{name:"Confirm disconnect"}).isDisabled(),false);}
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"No horizontal overflow "+width);
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log("Native platform buttons, premium lock, missing setup, viewer controls, disconnect and responsive layouts passed");
}catch(e){console.error(log);throw e;}finally{await browser?.close();if(server?.pid)try{process.kill(-server.pid,"SIGTERM");}catch{}await rm(folder,{recursive:true,force:true});}
