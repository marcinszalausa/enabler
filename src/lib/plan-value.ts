// Additional paid tools; existing creation, editing and publishing stay shared.
export function planTools(plan:unknown){
 const paid=plan==="starter"||plan==="plus"||plan==="growth";
 return {growthActionPlan:plan==="growth",weekPlanner:paid,resultsComparison:plan==="plus"||plan==="growth",resultsLimit:plan==="growth"?30:plan==="plus"?16:8};
}
export type ReportRow={id:string;network:string;caption:string;date:string;state:string;impressions:number|null;clicks:number|null;views:number|null};
export function sameNetworkComparison(rows:readonly ReportRow[]){
 const groups=new Map<string,ReportRow[]>();
 for(const row of rows){if(row.state!=="ready"||!row.network)continue;const list=groups.get(row.network)??[];list.push(row);groups.set(row.network,list);}
 return [...groups].filter(([,posts])=>posts.length>=2).map(([network,posts])=>({network,posts:[...posts].sort((a,b)=>{
  const rate=(r:ReportRow)=>r.impressions!==null&&r.impressions>0&&r.clicks!==null?r.clicks/r.impressions:-1;
  return rate(b)-rate(a);
 })}));
}
function csvCell(value:unknown){let text=value===null||value===undefined?"":String(value);if(/^[\s]*[=+\-@]|^[\t\r\n]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
export function resultsCsv(rows:readonly ReportRow[]){return [["Post ID","Network","Posted date","Caption","Data status","Impressions","Clicks","Video views","Click rate (%)"],...rows.map(r=>[r.id,r.network,r.date,r.caption,r.state,r.impressions,r.clicks,r.views,r.impressions!==null&&r.impressions>0&&r.clicks!==null?(r.clicks/r.impressions*100).toFixed(2):null])].map(row=>row.map(csvCell).join(",")).join("\r\n");}
export type PlannedPost={id:string;headline:string;caption:string;productId:string;at:string};
const escapeCalendar=(text:string)=>text.replace(/\\/g,"\\\\").replace(/\r\n|\r|\n/g,"\\n").replace(/;/g,"\\;").replace(/,/g,"\\,");
const stamp=(date:string)=>new Date(date).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
function foldLine(line:string){const lines:string[]=[];let current="",bytes=0;for(const char of line){const size=new TextEncoder().encode(char).length;if(bytes+size>75){lines.push(current);current=" ";bytes=1;}current+=char;bytes+=size;}lines.push(current);return lines.join("\r\n");}
export function postingCalendar(posts:readonly PlannedPost[],createdAt:string){
 const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Gooidy//Posting Planner//EN","CALSCALE:GREGORIAN",...posts.flatMap(p=>["BEGIN:VEVENT","UID:"+p.id+"-"+stamp(p.at)+"@gooidy.com","DTSTAMP:"+stamp(createdAt),"DTSTART:"+stamp(p.at),"DURATION:PT15M","SUMMARY:"+escapeCalendar("Review & post: "+p.headline),"DESCRIPTION:"+escapeCalendar(p.caption+"\n\nReview the ad in Gooidy before publishing. This is a reminder, not a scheduled social post."),"URL:https://gooidy.com/dashboard/products/"+encodeURIComponent(p.productId),"END:VEVENT"]),"END:VCALENDAR"];
 return lines.map(foldLine).join("\r\n")+"\r\n";
}
