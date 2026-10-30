import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile,writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { setTimeout as pause } from "node:timers/promises";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
if(process.env.VERIFY_DEPLOYMENT==="true"){
  let deployed=false;
  for(let attempt=0;attempt<36;attempt++){
    const status=JSON.parse(execFileSync("gh",["api","repos/marcinszalausa/enabler/commits/"+process.env.GITHUB_SHA+"/status"],{encoding:"utf8"}));
    const state=status.statuses.find(item=>item.context==="Vercel")?.state;
    if(state==="success"){deployed=true;break;}
    if(state==="failure"||state==="error")throw new Error("Production deployment failed");
    await pause(10000);
  }
  if(!deployed)throw new Error("Production deployment did not become ready");
}
const reports=[];
for(let i=1;i<=3;i++){
  const path="/tmp/public-performance-"+i+".json";
  const run=spawnSync("/tmp/gooidy-performance/node_modules/.bin/lighthouse",[
    "https://gooidy.com","--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage",
    "--only-categories=performance","--output=json","--output-path="+path,"--quiet",
  ],{env:{...process.env,CHROME_PATH:chromium.executablePath()},stdio:"inherit",timeout:180000});
  if(run.status!==0)throw new Error("Lighthouse run failed");
  const report=JSON.parse(await readFile(path,"utf8"));
  const a=report.audits;
  if(report.runtimeError)throw new Error(report.runtimeError.message);
  const row={
    fcpMs:a["first-contentful-paint"].numericValue,
    lcpMs:a["largest-contentful-paint"].numericValue,
    tbtMs:a["total-blocking-time"].numericValue,
    cls:a["cumulative-layout-shift"].numericValue,
    bytes:a["total-byte-weight"].numericValue,
    performanceScore:Math.round(report.categories.performance.score*100),
    resources:a["resource-summary"]?.details?.items,
  };
  reports.push(row);console.log("PERFORMANCE_RUN",i,JSON.stringify(row));
}
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
const keys=["fcpMs","lcpMs","tbtMs","cls","bytes","performanceScore"];
const summary={
  phase:process.env.VERIFY_DEPLOYMENT==="true"?"production-after":"production-before",
  median:Object.fromEntries(keys.map(key=>[key,median(reports.map(row=>row[key]))])),
  runs:reports,
};
console.log("PERFORMANCE_MEDIAN",JSON.stringify(summary));
await writeFile("/tmp/performance-summary.json",JSON.stringify(summary,null,2));

if(process.env.VERIFY_DEPLOYMENT==="true"){
  const html=await (await fetch("https://gooidy.com")).text();
  const normalized=html.replaceAll("%2F","/").replaceAll("%2f","/");
  const ids=[...new Set([...normalized.matchAll(/\/api\/creatives\/([0-9a-f-]{36})\/image/g)].map(match=>match[1]))];
  for(const id of ids.slice(0,3)){
    const base="https://gooidy.com/api/creatives/"+id+"/image";
    const full=await fetch(base);
    if(full.status===404)continue;
    assert.equal(full.status,200,"Public original image loads");
    assert.match(full.headers.get("content-type")??"",/^image\/png/);
    const original=Buffer.from(await full.arrayBuffer());
    const preview=await fetch(base+"?preview=1");
    assert.equal(preview.status,200,"Preview loads on deployed runtime");
    assert.match(preview.headers.get("content-type")??"",/^image\/webp/);
    const small=Buffer.from(await preview.arrayBuffer());
    assert.ok(small.length<original.length,"Preview is smaller than export");
    const exportResponse=await fetch(base+"?preview=1&download=1");
    assert.equal(exportResponse.status,200);
    assert.match(exportResponse.headers.get("content-type")??"",/^image\/png/);
    assert.match(exportResponse.headers.get("content-disposition")??"",/attachment/);
    const exported=Buffer.from(await exportResponse.arrayBuffer());
    assert.equal(exported.readUInt32BE(16),original.readUInt32BE(16),"Export keeps original width");
    assert.equal(exported.readUInt32BE(20),original.readUInt32BE(20),"Export keeps original height");
    console.log("LIVE_PREVIEW_VERIFIED",JSON.stringify({originalBytes:original.length,previewBytes:small.length,width:original.readUInt32BE(16),height:original.readUInt32BE(20)}));
    break;
  }
}
