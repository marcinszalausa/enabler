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
