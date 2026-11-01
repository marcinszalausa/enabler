import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
export async function verifyLiveHomepageImages(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
 const browser=await chromium.launch({headless:true});
 try{
  for(const device of [{viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true},{viewport:{width:1440,height:1000},deviceScaleFactor:1}]){
   const page=await browser.newPage({...device,reducedMotion:"reduce"});
   await page.goto("https://gooidy.com",{waitUntil:"domcontentloaded",timeout:60000});
   await page.addStyleTag({content:"html{scroll-behavior:auto!important}"});
   for(let y=0;y<await page.evaluate(()=>document.documentElement.scrollHeight);y+=600){
    await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(200);
   }
   await page.waitForFunction(()=>[...document.images].filter(i=>i.getBoundingClientRect().width>0).every(i=>i.complete&&i.naturalWidth>0),{},{timeout:60000});
   const images=await page.locator("img").evaluateAll(imgs=>imgs.filter(i=>i.getBoundingClientRect().width>0).map(i=>({src:i.currentSrc||i.src,width:i.naturalWidth,complete:i.complete})));
   const creatives=images.filter(i=>decodeURIComponent(i.src).includes("/api/creatives/"));
   assert.ok(creatives.length>=4,"Real public creative images were checked");
   assert.ok(creatives.every(i=>decodeURIComponent(i.src).includes("preview=1")),"Public ads use lightweight previews");
   assert.ok(images.every(i=>i.complete&&i.width>0),"Every displayed image decodes");
   console.log("LIVE_HOMEPAGE_IMAGES_VERIFIED",JSON.stringify({width:device.viewport.width,dpr:device.deviceScaleFactor,images:images.length,creatives:creatives.length,broken:0}));
   await page.close();
  }
 }finally{await browser.close();}
}
if(process.argv[1]?.endsWith("check-live-homepage-images.mjs"))await verifyLiveHomepageImages();
