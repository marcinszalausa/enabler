import Link from "next/link";
import {localePath,type Locale} from "@/i18n/config";
import {PAID_PLANS,TRY_MODE} from "@/lib/paid-plans";
import {planTools} from "@/lib/plan-value";

// The customer journey (create, edit, publish, analyze) with what every plan
// gets at each stage. Allowances and tools come from the plan catalogue.
const ICONS={
 create:<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>,
 edit:<><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></>,
 publish:<><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M9 15l2 2 4-4"/></>,
 analyze:<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>,
};
type StageId=keyof typeof ICONS;
const STAGES:{id:StageId;name:string;doing:string;shared:string[]}[]=[
 {id:"create",name:"Create",doing:"Paste a product link. Get images and videos in your brand.",shared:["Good, Better or Best quality","Videos with voice, captions and music","17 ad languages","Saved logo, colors, font and voice"]},
 {id:"edit",name:"Edit",doing:"Polish wording, redo a scene, download what you like.",shared:["Automatic quality checks","Free headline and caption edits","3 free redos a month","Image and MP4 downloads"]},
 {id:"publish",name:"Publish",doing:"Post now or schedule across your social accounts.",shared:["10 social networks","Calendar in your time zone","Queue and opt-in autopilot"]},
 {id:"analyze",name:"Analyze",doing:"See what earned clicks. Make more of what works.",shared:["Impressions, clicks and views","Click rate per post","Tracked links for your store analytics"]},
];
const SAME="Same on every plan";
type Lane={id:string;name:string;price:number;recommended:boolean;cells:Record<StageId,string>;level:number};
function lanes():Lane[]{
 const lane=(p:{id:string;name:string;price:number;credits:number;recommended?:boolean},level:number):Lane=>{
  const t=planTools(p.id),paid=p.price>0;
  return {id:p.id,name:p.name,price:p.price,recommended:!!p.recommended,level,cells:{
   create:p.credits.toLocaleString("en-US")+(paid?" credits every month":" credits, once"),
   edit:SAME,
   publish:t.weekPlanner?"+ Weekly planner and reminders":"1 account, manual scheduling",
   analyze:t.growthActionPlan?"Compare 30 posts + a next-test action plan":t.resultsComparison?`Compare up to ${t.resultsLimit} posts + CSV report`:`Results for your last ${t.resultsLimit} posts`,
  }};
 };
 return [lane({...TRY_MODE,name:"Try"},0),...PAID_PLANS.map((p,i)=>lane(p,i+1))];
}
function Icon({name}:{name:StageId}){return <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONS[name]}</svg>;}
const tint=["bg-raised","bg-accent-soft/40","bg-accent-soft/70","bg-accent-soft"];
const price=(n:number)=>n>0?<><span className="font-semibold">${n}</span><span className="text-muted">/mo</span></>:<span className="font-semibold">Free</span>;
export function PlanJourney({locale}:{locale:Locale}){
 const rows=lanes();
 return <section id="plan-journey" data-plan-journey aria-labelledby="plan-journey-title" className="relative scroll-mt-24 overflow-hidden rounded-3xl border border-line bg-surface px-4 py-8 sm:px-8 sm:py-10">
  <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[36rem] max-w-full -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"/>
  <div className="relative text-center">
   <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Your growth journey</p>
   <h2 id="plan-journey-title" className="mt-2 text-2xl font-semibold sm:text-3xl">Create. Edit. Publish. Analyze.</h2>
   <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted">Every plan takes you through the whole journey. Higher plans give you more fuel along the way: more credits, a planner and deeper results. Every paid plan has a 30-day money-back guarantee on your first payment.</p>
  </div>

  {/* The road: the four stages, joined left to right (top to bottom on phones). */}
  <ol className="relative mt-10 grid gap-4 lg:grid-cols-4 lg:gap-5">
   <span aria-hidden className="absolute bottom-8 left-[1.4rem] top-8 w-0.5 bg-gradient-to-b from-accent/30 to-accent lg:hidden"/>
   <span aria-hidden className="absolute left-[12.5%] right-[12.5%] top-[1.4rem] hidden h-0.5 bg-gradient-to-r from-accent/30 to-accent lg:block"/>
   {STAGES.map((s,i)=><li key={s.id} data-journey-stage={s.id} className="relative flex gap-4 lg:flex-col lg:items-center lg:gap-0">
    <span className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-accent bg-raised text-accent shadow-sm"><Icon name={s.id}/></span>
    <article className="min-w-0 flex-1 rounded-2xl border border-line bg-raised p-5 lg:mt-5 lg:w-full lg:flex-none lg:self-stretch">
     <p className="text-xs font-medium uppercase tracking-wide text-muted">Stage {i+1}</p>
     <h3 className="mt-1 text-lg font-semibold">{s.name}</h3>
     <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.doing}</p>
     <p className="mt-4 text-xs font-semibold text-accent">On every plan</p>
     <ul className="mt-2 space-y-1.5 text-sm">{s.shared.map(f=><li key={f} className="flex gap-2"><span aria-hidden className="text-accent">✓</span><span>{f}</span></li>)}</ul>
     {/* Phones: what each plan adds at this stage, right under the stage. */}
     {rows.every(r=>r.cells[s.id]===SAME)?null:<dl className="mt-4 divide-y divide-line rounded-xl border border-line lg:hidden">{rows.map(r=><div key={r.id} className={"flex items-baseline justify-between gap-3 px-3 py-2 text-xs "+(r.recommended?"bg-accent-soft":"")}><dt className="shrink-0 font-semibold">{r.name}</dt><dd className="text-end text-muted">{r.cells[s.id]}</dd></div>)}</dl>}
    </article>
   </li>)}
  </ol>

  {/* Desktop: one lane per plan under the road, so each column reads as a stage. */}
  <div className="relative mt-6 hidden lg:block" role="table" aria-label="What each plan adds at every stage">
   <div role="rowgroup" className="grid gap-2">
    {rows.map(r=><div role="row" key={r.id} data-journey-lane={r.id} className={"relative grid grid-cols-4 gap-5 rounded-2xl border px-0 py-0 "+(r.recommended?"border-accent shadow-[0_20px_60px_-45px_var(--t-accent)]":"border-line")}>
     <span role="rowheader" className="absolute -top-2.5 left-4 flex items-center gap-2 rounded-full border border-line bg-raised px-2.5 py-0.5 text-xs"><span className="font-semibold">{r.name}</span>{price(r.price)}{r.recommended&&<span className="text-accent">· Recommended</span>}</span>
     {STAGES.map(s=><div role="cell" key={s.id} className={"rounded-2xl px-5 pb-3 pt-5 text-sm "+tint[r.level]+(r.cells[s.id]===SAME?" text-muted":"")}>{r.cells[s.id]}</div>)}
    </div>)}
   </div>
  </div>

  <div className="relative mt-8 flex flex-col items-center gap-2">
   <Link href={localePath(locale,"/start")} prefetch={false} className="btn-primary inline-flex min-h-12 items-center justify-center rounded-xl px-6 font-medium">Start your journey free</Link>
   <p className="text-xs text-muted">No card needed · Cancel any time</p>
  </div>
 </section>;
}
