// CI-only fixture route: never deployed with the application.
import assert from "node:assert/strict";
import { mkdir,writeFile,readFile,rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { setTimeout as pause } from "node:timers/promises";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
const fixturePath="src/app/[locale]/showcase-preview/page.tsx";
const fixture = [
'import { HeroStage } from "@/app/_landing/hero-stage";',
'import { Placements } from "@/app/_landing/placements";',
'import { BeforeAfter } from "@/app/_landing/before-after";',
'import { RunDemo } from "@/app/_landing/run-demo";',
'import { RunViewer } from "@/app/[locale]/use-cases/run-viewer";',
'import { heroProducts } from "@/lib/product-display";',
'const photo="/reels/softmila-cardigan.jpg";',
'const items=["A","B","C","D","A","D"].map((productKey,i)=>({productKey,image:photo,alt:productKey+i}));',
'const ads=[0,1,2].map(i=>({id:"ad"+i,angle:"comfort",headline:"Ad "+i,primaryText:"Example",aspect:(i===1?"1:1":"9:16") as "1:1"|"9:16",image:photo}));',
'const run={id:"run",productName:"Example product",productUrl:"https://example.com/products/a",store:"example.com",summary:"Example",audience:"Example",productImage:photo,seconds:30,ads};',
'export default function ShowcasePreview(){return <main className="landing">',
'{[1,2,3,4].map(n=>{const allowed=items.filter(x=>"ABCD".slice(0,n).includes(x.productKey));const plan=heroProducts(allowed);return <section key={n} data-scenario={n}><HeroStage {...plan}/></section>})}',
'<Placements ads={items.slice(0,4).map(x=>({productKey:x.productKey,store:"example",story:{image:photo,alt:x.alt},square:{image:photo,alt:x.alt,primaryText:"Example"}}))}/>',
'<div data-check="before"><BeforeAfter photo={photo} name="Example" url={run.productUrl} ads={ads.map(a=>({image:"/reels/showcase-fixture-"+a.id+".jpg",alt:a.headline}))}/></div>',
'<div data-check="demo"><RunDemo run={{...run,url:run.productUrl,ads}}/></div>',
'<div data-check="viewer"><RunViewer run={run} took="30 s"/></div>',
'</main>}',
].join("\n");
// Test fixture URLs with queries are intercepted before Next's image optimizer.
let browser,server;
let serverLog="";
try{
  const jpeg=await readFile("public/reels/softmila-cardigan.jpg");
  for(let i=0;i<3;i++)await writeFile("public/reels/showcase-fixture-ad"+i+".jpg",jpeg);
  await mkdir("src/app/[locale]/showcase-preview",{recursive:true});
  await writeFile(fixturePath,fixture);
  server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","-p","3100"],{
    env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture"},
    stdio:["ignore","pipe","pipe"],
  });
  const capture=chunk=>{serverLog=(serverLog+chunk).slice(-16000);};
  server.stdout.on("data",capture);server.stderr.on("data",capture);
  let ready=false;
  for(let attempt=0;attempt<120;attempt++){
    try{const r=await fetch("http://localhost:3100/showcase-preview",{signal:AbortSignal.timeout(2000)});if(r.ok){ready=true;break;}}catch{}
    await pause(1000);
  }
  assert.ok(ready,"Fixture server became ready");
  browser=await chromium.launch({headless:true});
  for(const [width,motion] of [[390,"no-preference"],[1440,"no-preference"],[1440,"reduce"]]){
    const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:motion,locale:"en-US"});
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.route("**/_next/image?**",route=>route.fulfill({status:200,contentType:"image/jpeg",body:jpeg}));
    await page.route("**/reels/*.jpg?**",route=>route.fulfill({status:200,contentType:"image/jpeg",body:jpeg}));
    await page.clock.install();
    await page.goto("http://localhost:3100/showcase-preview",{waitUntil:"networkidle",timeout:90000});
    for(const n of [1,2,3,4]){
      const hero=page.locator('[data-scenario="'+n+'"] [data-product-group="hero"]');
      await hero.scrollIntoViewIfNeeded();
      for(let tick=0;tick<8;tick++){
        const keys=await hero.locator("[data-product-key]").evaluateAll(nodes=>nodes.map(n=>n.dataset.productKey));
        assert.equal(keys.length,new Set(keys).size,"Unique hero products: "+width+" "+motion+" n="+n);
        assert.equal(keys.length,Math.min(n,3));
        await page.clock.fastForward(4000);
        await pause(800); // Allow real CSS transitions and React commits to finish.
      }
    }
    const placements=await page.locator('[data-product-group="placements"] [data-product-key]').evaluateAll(nodes=>nodes.map(n=>n.dataset.productKey));
    assert.equal(placements.length,new Set(placements).size);
    for(const name of ["before","viewer"]){
      const group=page.locator('[data-check="'+name+'"]');
      await group.scrollIntoViewIfNeeded();
      const buttons=group.locator("button");
      for(let i=0;i<await buttons.count();i++){
        await buttons.nth(i).click();
        assert.equal(await group.locator("img").count(),1,"One variant at a time in "+name);
      }
    }
    const demo=page.locator('[data-check="demo"]');
    await demo.scrollIntoViewIfNeeded();
    await pause(200); // Let IntersectionObserver start the demo before advancing RAF.
    await page.clock.runFor(11000);
    const display=demo.locator('[data-single-product-display="run-demo"]');
    await display.waitFor({state:"visible"});
    await display.locator("img").waitFor({state:"visible"});
    const buttons=display.locator("button");
    for(let i=0;i<await buttons.count();i++){
      await buttons.nth(i).click();
      assert.equal(await display.locator("img").count(),1,"One demo output at a time");
    }
    assert.deepEqual(errors,[],"No uncaught client errors");
    console.log("PASS product spacing, rotations and single-variant controls:",width,motion);
    await page.close();
  }
}catch(error){console.error(serverLog);throw error;}
finally{
  if(browser)await browser.close();
  if(server)server.kill("SIGTERM");
  await rm("src/app/[locale]/showcase-preview",{recursive:true,force:true});
  for(let i=0;i<3;i++)await rm("public/reels/showcase-fixture-ad"+i+".jpg",{force:true});
}
