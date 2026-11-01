import {createRequire} from "node:module";const require=createRequire(import.meta.url);const {chromium}=require("/tmp/homepage-browser/node_modules/playwright");
const browser=await chromium.launch({headless:true});
try{for(const viewport of [{width:390,height:844},{width:1440,height:1000}]){
 const page=await browser.newPage({viewport,reducedMotion:"reduce"});page.on("response",async r=>{if(r.url().includes("/_next/image"))console.log("BROWSER_IMAGE_RESPONSE",JSON.stringify({viewport,status:r.status(),url:r.url(),error:r.ok()?undefined:(await r.text()).slice(0,500)}));});page.on("requestfailed",r=>console.log("REQUEST_FAILED",r.url(),r.failure()));
 await page.goto("https://gooidy.com",{waitUntil:"domcontentloaded"});
 for(let y=0;y<10000;y+=600){await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(750);}
 await page.waitForTimeout(10000);
 console.log("BROWSER_IMAGES",JSON.stringify(await page.locator("img").evaluateAll(imgs=>imgs.map(i=>({src:i.currentSrc||i.src,complete:i.complete,width:i.naturalWidth,alt:i.alt})))));
 await page.close();
}}finally{await browser.close();}
