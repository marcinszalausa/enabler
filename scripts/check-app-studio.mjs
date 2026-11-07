import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {setTimeout as pause} from 'node:timers/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
const folder='src/app/[locale]/app-studio-preview/[[...section]]';
let server,browser,currentPage,log='';
const fixture=`import {Suspense} from 'react';
import {DashboardFrame} from '@/app/[locale]/dashboard/dashboard-frame';
import {AppNav} from '@/app/[locale]/dashboard/app-nav';
import {AccountMenu} from '@/app/[locale]/dashboard/account-menu';
import {CreditsView} from '@/app/[locale]/dashboard/credits-link';
import {ProductCard} from '@/app/[locale]/dashboard/product-card';
import {ProductUrlForm} from '@/app/[locale]/dashboard/product-url-form';
import {LibraryView} from '@/app/[locale]/dashboard/ads/library-view';
import {BrandForm} from '@/app/[locale]/dashboard/brand/brand-form';
import {CampaignForm} from '@/app/[locale]/dashboard/campaigns/campaign-form';
import {ConnectStoreCard,StoreConnectionCard} from '@/app/[locale]/dashboard/stores/stores-view';
import {EmptyState,ProgressCard} from '@/app/[locale]/dashboard/ui';
import {STUDIO_ADS} from '@/lib/studio-showcase';
import {getMessages} from '@/i18n/messages';import {isLocale} from '@/i18n/config';
type Props={params:Promise<{locale:string;section?:string[]}>;searchParams:Promise<Record<string,string>>};
export default function Preview(p:Props){return <Suspense fallback={<p>Loading…</p>}><Content {...p}/></Suspense>}
async function Content({params,searchParams}:Props){const {locale,section}=await params,p=await searchParams;if(!isLocale(locale))return null;const t=await getMessages(locale),current=section?.[0]||'products';
const sections=[['products',t.app.products],['ads',t.library.title],['campaigns',t.app.campaigns],['publishing',t.publish.title],['brand',t.app.brandKit],['stores','Stores'],['billing',t.billing.title]];
const products=STUDIO_ADS.slice(1).map((a,i)=>({id:'00000000-0000-4000-8000-00000000000'+i,name:a.label,url:'https://example.com/products/'+a.id,image_urls:[a.image],created_at:'2026-11-01T12:00:00Z'}));
const ads=products.map((p,i)=>({id:p.id,workspaceId:'fixture',generationId:'fixture',productId:p.id,productName:p.name,kind:'image' as const,aspect:'9:16',headline:STUDIO_ADS[i+1].alt,caption:'A fixture ad for visual review.',createdAt:p.created_at,favorite:false,imageVersion:'1'}));
return <DashboardFrame nav={<AppNav items={sections.map(([id,label])=>({href:'/app-studio-preview/'+id,label}))}/>} account={<AccountMenu email='preview@example.com'/>} credits={<CreditsView credits={300} number='300' label='300 credits' low={false} lowLabel='Low credits'/>} activity={<div data-activity-feed><ProgressCard title='Creating your ads'>Your images will appear here.</ProgressCard><p className='mt-4 text-sm text-muted'>Recent activity</p></div>} workspaceLabel={t.app.workspace} skipLabel={t.nav.skip}>
<main className={'mx-auto w-full flex-1 px-4 py-10 '+(current==='brand'?'max-w-xl':'max-w-5xl')}><header><p className='text-sm text-muted'>Example workspace</p><h1 className='mt-1'>{sections.find(s=>s[0]===current)?.[1]}</h1></header>
{current==='products'&&<><section id='add' className='app-product-intake edge mt-8 p-6 sm:p-8'><h2 className='text-lg'>{t.app.addTitle}</h2><p className='mt-1 text-sm text-muted'>{t.app.addBody}</p><div className='mt-5'><ProductUrlForm defaultUrl=''/></div></section><ul className='app-product-grid mt-8 grid'>{products.map(p=><li key={p.id}><ProductCard product={p}/></li>)}</ul></>}
{current==='ads'&&<LibraryView t={t} ads={ads} filter={{kind:'all',favorites:false,page:1}} hasNext={false}/>}
{current==='brand'&&<div className='mt-8'><BrandForm accentColor='#5b4bf7' font='inter' fonts={[{key:'inter',label:'Inter'}]} logoUrl={null}/></div>}
{current==='campaigns'&&<CampaignForm id='fixture' products={products} ideas={[]}/>}
{current==='stores'&&<div className='mt-8'><ConnectStoreCard workspaceId='fixture' owner={p.mode!=='viewer'} ready={p.mode!=='disabled'}/>{['connected','syncing','error'].map(status=><StoreConnectionCard key={status} store={{id:status,name:'Example store',shop:'example.myshopify.com',status}} workspaceId='fixture' owner={p.mode!=='viewer'} ready={true}/>)}</div>}
{current==='publishing'&&<div className='mt-8'><EmptyState title={t.library.empty}>{t.journey.addHint}</EmptyState></div>}
{current==='billing'&&<section className='edge mt-8 p-6'><p className='text-sm text-muted'>Generation credits</p><p className='mt-2 text-5xl font-semibold tracking-tight'>300</p><button disabled className='btn-primary mt-6 px-5 py-3'>Purchase unavailable</button><p className='mt-4 text-sm text-warn'>Low-credit notices remain visible</p></section>}
</main></DashboardFrame>}
`;
try{
 await mkdir(folder,{recursive:true});await writeFile(folder+'/page.tsx',fixture);
 await mkdir('/tmp/app-studio-review',{recursive:true});
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3121'],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'https://catalog-test.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'},detached:true,stdio:['ignore','pipe','pipe']});
 const capture=b=>{log=(log+b).slice(-22000);};server.stdout.on('data',capture);server.stderr.on('data',capture);
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch('http://localhost:3121/app-studio-preview/products',{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await pause(1000);}assert.ok(ready,'Preview started');
 const manifest=JSON.parse(await readFile('src/lib/homepage-media.json','utf8')),asset=Object.values(manifest.images)[0].src;
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||undefined,headless:true});
 for(const [width,locale,theme] of [[320,'en','light'],[390,'en','light'],[390,'ja','dark'],[768,'de','light'],[1440,'en','light'],[1920,'en','dark']]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];currentPage=page;let posts=0;
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST'&&!/\/(?:_next|__nextjs)/.test(new URL(r.url()).pathname))posts++;});
  await page.route('**/api/creatives/**/image?*',async route=>{const response=await route.fetch({url:'http://localhost:3121'+asset});await route.fulfill({response});});
  await page.addInitScript(theme=>{localStorage.setItem('gooidy-theme',theme);},theme);
  const prefix=locale==='en'?'':'/'+locale,base='http://localhost:3121'+prefix+'/app-studio-preview/';
  for(const section of ['products','ads','campaigns','publishing','brand','stores','billing']){
   await page.goto(base+section,{waitUntil:'networkidle',timeout:90000});
   assert.equal(await page.locator('[data-app-studio]').count(),1);
   assert.equal(await page.locator('[data-boost]').count(),0,'No unbuilt teaser in the workspace');
   const buttonColor=await page.locator('[data-create-new]').evaluate(e=>getComputedStyle(e).backgroundColor);
   assert.ok((theme==='light'?['rgb(22, 22, 23)','rgb(53, 53, 56)']:['rgb(245, 245, 247)','rgb(222, 222, 229)']).includes(buttonColor),'Neutral primary button including its hover state');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No overflow '+width+' '+section);
   if(section==='products'){
    await page.locator('[data-create-new]').click();assert.equal(await page.locator('#url').evaluate(e=>document.activeElement===e),true);
    const images=page.locator('.app-product-card img');assert.equal(await images.count(),4);assert.equal(await images.first().evaluate(e=>getComputedStyle(e).objectFit),'contain');
    if(width===390||width===1440)await page.screenshot({path:'/tmp/app-studio-review/products-'+width+'-'+theme+'.png',fullPage:true});
   }
   if(section==='ads'){
    await page.locator('[data-library-preview]').first().click();const dialog=page.locator('dialog[open]');assert.equal(await dialog.count(),1);await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
    if(width===390||width===1440)await page.screenshot({path:'/tmp/app-studio-review/ads-'+width+'-'+theme+'.png',fullPage:true});
   }
   if(section==='brand'){
    const input=page.locator('input[name=name]');await input.fill('Example brand');assert.ok((await input.boundingBox()).height>=44);assert.ok((await page.getByRole('button',{name:/Save/i}).boundingBox()).height>=44);
   }
   if(section==='stores'){
    assert.equal(await page.getByRole('button',{name:'Connect Shopify'}).isDisabled(),false);
    const card=page.locator('[data-store-connection]').first();await card.locator('summary').click();assert.ok(await card.getByRole('button',{name:'Confirm disconnect'}).isVisible());
   }
  }
  await page.goto(base+'products',{waitUntil:'networkidle'});
  if(width<1024){
   await page.locator('[data-app-menu]').click();assert.ok(await page.locator('[data-app-drawer][open]').isVisible());await page.keyboard.press('Escape');assert.equal(await page.locator('[data-app-drawer][open]').count(),0);
   await page.locator('[data-app-menu]').click();await page.locator('[data-app-tab]:visible').nth(1).click();await page.waitForURL(u=>u.pathname.endsWith('/ads'));assert.equal(await page.locator('[data-app-drawer][open]').count(),0);
   await page.locator('[data-activity-toggle]').click();assert.ok(await page.locator('[data-activity-panel][data-open]').isVisible());await page.keyboard.press('Escape');assert.equal(await page.locator('[data-activity-panel]').isVisible(),false);
  }else{
   assert.equal(await page.locator('[data-activity-panel]').getAttribute('data-open'),null,'Activity defaults folded');
   await page.locator('[data-menu-fold]').click();assert.equal(await page.locator('[data-app-sidebar]').getAttribute('data-collapsed'),'');
   await page.locator('[data-menu-fold]').click();
   await page.locator('[data-activity-fold]').click();assert.ok(await page.locator('[data-activity-panel][data-open]').isVisible());await page.reload({waitUntil:'networkidle'});assert.ok(await page.locator('[data-activity-panel][data-open]').isVisible(),'Saved panel preference');await page.locator('[data-activity-fold]').click();
   const main=await page.locator('#app-content>main').boundingBox();assert.ok(main.width>width-330,'Workspace uses remaining width');
  }
  for(const mode of ['disabled','viewer']){
   await page.goto(base+'stores?mode='+mode,{waitUntil:'networkidle'});const connect=page.getByRole('button',{name:'Connect Shopify'});
   if(mode==='viewer')assert.equal(await connect.count(),0);else assert.equal(await connect.isDisabled(),true);
  }
  assert.equal(posts,0,'Visual navigation never spends credits, changes a store or publishes');assert.deepEqual(errors,[]);console.log('PASS signed-in design, forms, media, menus, permissions and themes',width,locale,theme);await page.close();
 }
}catch(e){if(currentPage&&!currentPage.isClosed())await currentPage.screenshot({path:'/tmp/app-studio-review/failure.png',fullPage:true}).catch(()=>{});console.error(log);throw e;}finally{await browser?.close();if(server?.pid)try{process.kill(-server.pid,'SIGTERM');}catch{}await rm('src/app/[locale]/app-studio-preview',{recursive:true,force:true});}
