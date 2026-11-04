"use client";
import Link from "next/link";
import {growthTests,growthTestingBrief,MIN_TEST_IMPRESSIONS} from "@/lib/growth-testing";
import type {ReportRow} from "@/lib/plan-value";
export function GrowthActionPlan({rows}:{rows:ReportRow[]}){
 const tests=growthTests(rows);
 function download(){
  const url=URL.createObjectURL(new Blob([growthTestingBrief(tests,new Date().toISOString())],{type:"text/plain;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="gooidy-growth-testing-plan.txt";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <section data-growth-action-plan className="edge mt-6 min-w-0 border-accent p-5 sm:p-6">
  <p className="text-xs font-medium text-accent">Only in Growth</p>
  <h2 className="mt-2 text-xl font-semibold">Your next tests, guided by results</h2>
  <p className="mt-3 text-sm leading-relaxed text-muted">Turn observed post results into a practical brief for your next creative. Planning and downloading use no generation credits.</p>
  {!tests.length?<div className="mt-4 rounded-xl bg-surface p-4 text-sm">
   <p>Load network results above to build your plan. Each suggestion needs two distinct posts on the same network or network combination, each with at least {MIN_TEST_IMPRESSIONS} impressions, usable click data and a difference in observed click rate.</p>
   <p className="mt-2 text-muted">If there is not enough reliable data, we do not invent a recommendation.</p>
  </div>:<>
   <ol className="mt-5 grid gap-4">{tests.map((test,i)=><li key={test.network} className="min-w-0 rounded-xl border border-line bg-surface p-4">
    <p className="text-xs font-medium text-accent">Test {i+1} · {test.network}</p>
    <h3 className="mt-2 font-semibold">Try a new opening for this message</h3>
    <p className="mt-3 break-words text-sm">{test.source.caption||"Your published post"}</p>
    <p className="mt-2 text-xs text-muted">Observed click rate: {test.sourceRate.toFixed(2)}% · {test.source.impressions?.toLocaleString()} impressions · Posted {test.source.date}</p>
    <p className="mt-1 text-xs text-muted">Comparison: {test.referenceRate.toFixed(2)}% · {test.reference.impressions?.toLocaleString()} impressions · Posted {test.reference.date}</p>
    <p className="mt-3 text-sm"><strong>Next test:</strong> keep the product and offer. Change one headline or opening scene, then compare on the same network after similar time and reach.</p>
    <a href={"#post-"+test.source.id} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-accent">Review the starting post ↓</a>
   </li>)}</ol>
   <button type="button" onClick={download} className="btn-primary mt-5 min-h-11 rounded-xl px-4 text-sm font-medium">Download next-campaign brief</button>
   <Link href="/dashboard/campaigns" className="ms-3 mt-3 inline-flex min-h-11 items-center text-sm font-medium text-accent">Plan your next campaign →</Link>
  </>}
  <p className="mt-4 text-xs leading-relaxed text-muted">These are exploratory ideas, not proof of a winning ad. Dates, audiences and reporting windows can differ. Nothing is generated, scheduled or published automatically. Creating a new ad uses its displayed credit price.</p>
 </section>;
}
