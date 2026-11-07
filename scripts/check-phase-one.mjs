import assert from 'node:assert/strict';
import {mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {setTimeout as pause} from 'node:timers/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH),folder='src/app/[locale]/phase-one-preview';
let browser,server,currentPage,log='';
const fixture=`import {Suspense} from 'react';import {DashboardFrame} from '@/app/[locale]/dashboard/dashboard-frame';import {TrainingPanel} from '@/app/[locale]/dashboard/stores/products/[id]/training-panel';import {CsvImport} from '@/app/[locale]/dashboard/stores/csv-import';import {STUDIO_ADS} from '@/lib/studio-showcase';
export default function Preview(p:{searchParams:Promise<Record<string,string>>}){return <Suspense fallback={<p>Loading…</p>}><Content {...p}/></Suspense>}
async function Content({searchParams}:{searchParams:Promise<Record<string,string>>}){const {mode='setup'}=await searchParams;const photos=Array.from({length:12},(_,i)=>({key:'store:'+i,url:STUDIO_ADS[i%STUDIO_ADS.length].image}));const job=mode==='setup'?null:{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',status:mode==='review'?'succeeded':mode==='unknown'?'submission_unknown':'dataset_ready',review_status:'pending',image_count:12,error_code:null,budget_cents:1000};return <DashboardFrame nav={<p>Stores</p>} account={<p>Preview</p>} credits={<span>300</span>} activity={<p>No activity</p>} workspaceLabel='Your workspace' skipLabel='Skip to content'><main className='mx-auto w-full max-w-5xl px-4 py-10'><h1>Product preparation</h1><TrainingPanel itemId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' revision='revision' photos={photos} job={job} samples={mode==='review'?[0,1,2].map(scenario=>({scenario,status:'succeeded',url:photos[scenario].url})):[]} configured={mode!=='setup'} spendingEnabled={mode==='ready'} budgetCents={mode==='ready'?1000:null}/><CsvImport workspaceId='fixture-workspace'/></main></DashboardFrame>}
`;
try{
 await mkdir(folder,{recursive:true});await writeFile(folder+'/page.tsx',fixture);await mkdir('/tmp/phase-one-review',{recursive:true});
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3124'],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'https://catalog-test.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'},detached:true,stdio:['ignore','pipe','pipe']});
 const capture=b=>log=(log+b).slice(-16000);server.stdout.on('data',capture);server.stderr.on('data',capture);
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch('http://localhost:3124/phase-one-preview',{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await pause(1000);}assert.ok(ready);
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||undefined,headless:true});
 for(const width of [320,390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});currentPage=page;const errors=[],actions=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/catalog/training',async route=>{const body=route.request().postDataJSON();actions.push(body);assert.equal(body.itemId,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');await route.fulfill({status:202,contentType:'application/json',body:JSON.stringify({queued:true})});});
  let uploads=0;await page.route('**/api/catalog/training-photos?*',async route=>{uploads++;assert.ok(route.request().postDataBuffer().length<4*1024*1024);await route.fulfill({status:200,contentType:'application/json',body:'{"saved":true}'});});
  let imports=0;await page.route('**/api/catalog/csv',async route=>{imports++;const body=route.request().postDataJSON();assert.equal(body.rightsConfirmed,true);assert.equal(body.workspaceId,'fixture-workspace');await route.fulfill({status:202,contentType:'application/json',body:'{"products":1}'});});
  for(const mode of ['setup','ready','unknown','review']){
   await page.goto('http://localhost:3124/phase-one-preview?mode='+mode,{waitUntil:'networkidle',timeout:90000});
   const panel=page.locator('[data-training-panel]'),prepare=panel.getByRole('button',{name:'Prepare selected photos'});assert.equal(await prepare.isDisabled(),true);
   const before=actions.length;await page.waitForTimeout(100);assert.equal(actions.length,before,'No automatic paid request');
   await panel.getByRole('checkbox',{name:/I own these photos/}).check();await panel.getByRole('checkbox',{name:/Every selected photo/}).check();
   assert.equal(await prepare.isDisabled(),mode==='setup');
   if(mode==='setup'){
    const manifest=JSON.parse(await readFile('src/lib/homepage-media.json','utf8')),image=Object.values(manifest.images)[0].src;
    await panel.locator('input[type=file]').setInputFiles('public'+image);await page.waitForFunction(()=>document.querySelector('[data-training-panel]')?.textContent.includes('photo(s) added'));assert.equal(uploads,1);
   }
   if(mode==='ready'){
    await prepare.click();await page.waitForFunction(()=>document.querySelector('[data-training-panel]')?.textContent.includes('Request received'));assert.equal(actions.at(-1).action,'prepare');assert.equal(actions.at(-1).photos.length,12);assert.equal(actions.at(-1).rightsConfirmed,true);
    await panel.getByRole('button',{name:'Start one training test'}).click();await page.waitForTimeout(100);assert.equal(actions.at(-1).action,'start');assert.equal(actions.at(-1).budgetConfirmed,true);
   }
   if(mode==='unknown')assert.equal(await panel.getByRole('button',{name:'Start one training test'}).count(),0,'Unknown submission cannot be charged again');
   if(mode==='review'){
    const approve=panel.getByRole('button',{name:'Approve model'});assert.equal(await approve.isDisabled(),true);await panel.getByRole('checkbox',{name:/I checked all three/}).check();assert.equal(await approve.isDisabled(),false);await approve.click();await page.waitForTimeout(100);assert.equal(actions.at(-1).verdict,'approved');assert.equal(actions.at(-1).fidelityConfirmed,true);
    if(width===390||width===1440)await page.screenshot({path:'/tmp/phase-one-review/model-review-'+width+'.png',fullPage:true});
   }
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No overflow '+mode+' '+width);
  }
  const csv=page.locator('[data-csv-import]');await csv.locator('summary').click();await csv.getByLabel('Your store website').fill('https://store.example');await csv.locator('input[type=file]').setInputFiles({name:'catalog.csv',mimeType:'text/csv',buffer:Buffer.from('external_id,url,name,images,inventory_quantity,updated_at\np1,https://store.example/p1,Product,,5,2026-11-07T00:00:00Z\n')});await csv.getByRole('checkbox').check();await csv.getByRole('button',{name:'Import products'}).click();await page.waitForTimeout(150);assert.equal(imports,1);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);console.log('PASS phase-one mobile controls, photo upload, explicit training consent, model review and CSV import',width);await page.close();
 }
}catch(e){if(currentPage&&!currentPage.isClosed())await currentPage.screenshot({path:'/tmp/phase-one-review/failure.png',fullPage:true}).catch(()=>{});console.error(log);throw e;}finally{await browser?.close();if(server?.pid)try{process.kill(-server.pid,'SIGTERM');}catch{}await rm(folder,{recursive:true,force:true});}
