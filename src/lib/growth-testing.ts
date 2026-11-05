import type {ReportRow} from "./plan-value.ts";
export const MIN_TEST_IMPRESSIONS=500;
export type GrowthTest={network:string;source:ReportRow;reference:ReportRow;sourceRate:number;referenceRate:number};
function usable(row:ReportRow){
 return row.state==="ready"&&!!row.id&&!!row.network.trim()&&Number.isSafeInteger(row.impressions)&&row.impressions!>=MIN_TEST_IMPRESSIONS&&Number.isSafeInteger(row.clicks)&&row.clicks!>=0&&row.clicks!<=row.impressions!;
}
// Exploratory ideas, not controlled experiments or proof of a winning creative.
export function growthTests(rows:readonly ReportRow[]):GrowthTest[]{
 const unique=new Map<string,ReportRow>();for(const row of rows)if(usable(row)&&!unique.has(row.id))unique.set(row.id,row);
 const groups=new Map<string,ReportRow[]>();for(const row of unique.values()){const list=groups.get(row.network)??[];list.push(row);groups.set(row.network,list);}
 const rate=(r:ReportRow)=>r.clicks!/r.impressions!*100;
 return [...groups].flatMap(([network,posts])=>{
  if(posts.length<2)return [];
  const sorted=[...posts].sort((a,b)=>rate(b)-rate(a)||b.impressions!-a.impressions!||a.id.localeCompare(b.id));
  const source=sorted[0],reference=sorted.at(-1)!;if(rate(source)<=rate(reference))return [];
  return [{network,source,reference,sourceRate:rate(source),referenceRate:rate(reference)}];
 }).sort((a,b)=>(b.source.impressions!+b.reference.impressions!)-(a.source.impressions!+a.reference.impressions!)||a.network.localeCompare(b.network)).slice(0,3);
}
export function growthTestingBrief(tests:readonly GrowthTest[],reviewedAt:string){
 const lines=["GOOIDY — NEXT-CAMPAIGN TESTING BRIEF","Reviewed: "+reviewedAt,"","Exploratory recommendations from observed social-post results. Posting dates, audiences and reporting windows may differ. These are not controlled A/B tests, guaranteed winners, sales attribution or automatic publishing.",""];
 for(const [i,test] of tests.entries())lines.push("TEST "+(i+1)+" — "+test.network,
  "Starting post: "+test.source.id+" · "+test.source.date,
  "Starting caption: "+(test.source.caption||"(No caption)"),
  "Observed click rate: "+test.sourceRate.toFixed(2)+"% from "+test.source.impressions+" impressions",
  "Comparison post: "+test.reference.id+" · "+test.reference.date,
  "Comparison caption: "+(test.reference.caption||"(No caption)"),
  "Observed comparison click rate: "+test.referenceRate.toFixed(2)+"% from "+test.reference.impressions+" impressions",
  "Hypothesis: the stronger observed message or opening may be worth testing again.",
  "Next creative: keep the product, offer, destination and call to action; change one headline or opening scene.",
  "Review: publish only after your review. Compare on the same network or network combination after a similar reporting window and reach.",
  "Making a new image or video uses the credit price shown before generation.","");
 return lines.join("\n");
}
