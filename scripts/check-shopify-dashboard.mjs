import assert from "node:assert/strict";
import {mkdir,writeFile,rm} from "node:fs/promises";
import {spawn} from "node:child_process";
import {createRequire} from "node:module";
import {setTimeout as pause} from "node:timers/promises";
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
const folder="src/app/[locale]/shopify-preview";
let browser,server,log="";
try{
 await mkdir(folder,{recursive:true});
 await writeFile(folder+"/page.tsx",[
 'import {Suspense} from "react";import {ConnectStoreCard,StoreConnectionCard} from "@/app/[locale]/dashboard/stores/stores-view";',
 'export default function Preview({searchParams}:{searchParams:Promise<Record<string,string>>}){return <Suspense fallback={<p>Loading</p>}><Content searchParams={searchParams}/></Suspense>}',
 'async function Content({searchParams}:{searchParams:Promise<Record<string,string>>}){const p=await searchParams;return <main className="landing mx-auto max-w-5xl px-4 py-8"><h1>Your stores</h1><ConnectStoreCard workspaceId="fixture" owner={p.mode!=="viewer"} ready={p.mode!=="disabled"}/>{["connected","syncing","error"].map(status=><StoreConnectionCard key={status} store={{id:status,name:"Soft Mila",shop:"softmila.myshopify.com",status}} workspaceId="fixture" owner={p.mode!=="viewer"} ready={true}/>)}</main>}'
 ].join("\n"));
 server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","-p","3116"],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture"},detached:true,stdio:["ignore","pipe","pipe"]});
 const capture=b=>{log=(log+b).slice(-12000);};server.stdout.on("data",capture);server.stderr.on("data",capture);
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch("http://localhost:3116/shopify-preview",{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await pause(1000);}assert.ok(ready,"Preview started");
 browser=await chromium.launch({headless:true});
 for(const width of [320,390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:"reduce"}),errors=[];page.on("pageerror",e=>errors.push(e.message));
  for(const mode of ["owner","disabled","viewer"]){
   await page.goto("http://localhost:3116/shopify-preview?mode="+mode,{waitUntil:"networkidle",timeout:90000});
   const input=page.getByLabel("Your Shopify store address"),connect=page.getByRole("button",{name:"Connect Shopify"});
   if(mode==="viewer"){assert.equal(await connect.count(),0);assert.equal(await input.count(),0);}
   else{
    assert.equal(await connect.isDisabled(),mode==="disabled");
    assert.equal(await input.isDisabled(),mode==="disabled");
    assert.ok((await connect.boundingBox()).height>=44);
    if(mode==="owner"){
     await input.fill("softmila.myshopify.com");
     assert.equal(await input.inputValue(),"softmila.myshopify.com");
     const card=page.locator("[data-store-connection]").first();
     assert.equal(await card.getByRole("button",{name:"Confirm disconnect"}).isVisible(),false);
     await card.locator("summary").click();
     assert.equal(await card.getByRole("button",{name:"Confirm disconnect"}).isVisible(),true);
     assert.ok((await card.getByRole("button",{name:"Confirm disconnect"}).boundingBox()).height>=44);
     assert.equal(await page.locator("[data-store-connection]").nth(1).getByRole("button",{name:"Sync products"}).isDisabled(),true);
    }
   }
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"No horizontal overflow at "+width);
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log("Shopify cards: owner/viewer controls, unavailable state, disconnect confirmation and mobile layout passed");
}catch(e){console.error(log);throw e;}finally{
 await browser?.close();if(server?.pid)try{process.kill(-server.pid,"SIGTERM");}catch{}
 await rm(folder,{recursive:true,force:true});
}
