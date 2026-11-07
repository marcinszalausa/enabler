import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire('/tmp/gooidy-browser/package.json');
const {chromium}=require('playwright');
const browser=await chromium.launch({headless:true});
try {
 for(const width of [390,1440]) {
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  await page.goto('http://localhost:3000/en',{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'Product ads without the production work.'}).waitFor();
  const input=page.getByRole('textbox',{name:'Your store URL',exact:true});
  await input.fill('javascript:alert(1)');
  await page.getByRole('button',{name:'Initialize'}).click();
  assert.equal(await page.locator('[data-calibration] [role=alert]').count(),1);
  assert.equal(await page.locator('.calibration-dialog').evaluate(d=>d.open),false);
  await input.fill('softmila.com');
  assert.equal(await page.locator('.calibration-dialog').evaluate(d=>d.open),false,'typing must not open modal');
  await page.getByRole('button',{name:'Initialize'}).click();
  await page.getByRole('heading',{name:'What is your monthly ad spend?'}).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.calibration-dialog').evaluate(d=>d.open),false);
  assert.equal(await page.getByRole('button',{name:'Initialize'}).evaluate(el=>el===document.activeElement),true);
  for(const [label,id] of [['Getting started','starter'],['Growing','plus'],['Scaling','growth']]) {
   await page.getByRole('button',{name:'Initialize'}).click();
   await page.locator('.calibration-options button').filter({hasText:label}).click();
   const result=page.locator('[data-recommended-plan="'+id+'"]');
   await result.waitFor();
   assert.equal(await result.evaluate(el=>el===document.activeElement),true,'selection focuses recommendation');
   assert.equal(await page.locator('.calibration-dialog').evaluate(d=>d.open),false);
   if(id==='starter') {
    const target=new URL(await result.getByRole('link',{name:'Create your first ad'}).getAttribute('href'),'https://gooidy.com');
    assert.equal(target.searchParams.get('plan'),'starter');
    assert.equal(target.searchParams.get('url'),'https://softmila.com/');
   } else {
    const target=new URL(await result.getByRole('link',{name:'Connect store',exact:false}).getAttribute('href'),'https://gooidy.com');
    assert.equal(target.pathname,'/login');
    assert.match(target.searchParams.get('next'),/dashboard\/stores/);
    assert.match(await result.textContent(),/active Grow or Scale/);
   }
   if(id==='growth')assert.match(await result.getByRole('link',{name:'Request Architectural Review'}).getAttribute('href'),/^mailto:hello@gooidy.com/);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  }
  await page.getByRole('button',{name:'Change ad-spend range'}).click();
  await page.getByRole('button',{name:'Close calibration'}).focus();
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.getByRole('button',{name:'Not sure yet? Start with Launch'}).evaluate(el=>el===document.activeElement),true,'keyboard focus remains in modal');
  await page.keyboard.press('Escape');
  await page.screenshot({path:'/tmp/calibration-'+width+'.png',fullPage:true});
  await page.close();
 }
 const context=await browser.newContext({javaScriptEnabled:false});
 const page=await context.newPage();
 await page.goto('http://localhost:3000/en');
 await page.getByRole('textbox',{name:'Your store URL',exact:true}).fill('https://softmila.com');
 await page.getByRole('button',{name:'Initialize'}).click();
 await page.waitForURL(/\/start\?url=/);
 await context.close();
 console.log('Calibration mobile, desktop, validation, recommendations, keyboard and no-JS checks passed');
} finally {await browser.close();}
