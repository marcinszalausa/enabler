"use client";
import Link from "next/link";
import {useI18n} from "@/i18n/client";
import {fmt} from "@/i18n/format";
import {ASPECTS,ADS_PER_GENERATION,GENERATION_COST} from "@/lib/image-pricing";
import {imageCapacity} from "@/lib/trial-capacity";
export function TrialCampaign({credits,hasAds,published,canEdit=true}:{credits:number;hasAds:boolean;published:boolean;canEdit?:boolean}){
 const {t}=useI18n();
 const steps=[{label:t.trial.create,href:"?setup=image#generate-ads",done:hasAds,icon:"image"},{label:t.trial.pick,href:"#your-ads",done:published,icon:"heart"},{label:t.trial.publish,href:"/dashboard/publishing",done:published,icon:"send"}];
 return <section data-trial-campaign className="mt-8 rounded-2xl border border-line bg-raised p-5 sm:p-7">
   <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">{t.trial.title}</h2><p className="mt-1 text-sm text-muted">{t.trial.oneTime}</p></div>
   <p data-image-capacity className="rounded-xl bg-accent-soft px-4 py-3 text-sm font-medium text-accent">{fmt(t.trial.capacity,{count:imageCapacity(credits,GENERATION_COST,ADS_PER_GENERATION*ASPECTS.length)})}</p></div>
   <ol className="mt-5 grid gap-3 sm:grid-cols-3">{steps.map((step,i)=><li key={step.icon} className="flex min-w-0 items-center gap-3 rounded-xl border border-line p-4">
     <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent" aria-hidden="true">{step.done?"✓":<StepIcon kind={step.icon}/>}</span>
     {canEdit?<Link href={step.href} className="min-h-11 content-center text-sm font-medium hover:text-accent">{i+1}. {step.label}</Link>:<span className="text-sm">{i+1}. {step.label}</span>}
   </li>)}</ol>
   <p className="mt-4 text-xs leading-relaxed text-muted">{t.home.adSpend}</p>
   {hasAds&&<div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5"><p className="text-sm font-medium">{t.trial.continue}</p><Link href="/#pricing" prefetch={false} className="min-h-11 content-center rounded-lg border border-line-strong px-4 text-sm font-medium hover:text-accent">{t.trial.plans}</Link></div>}
 </section>;
}
function StepIcon({kind}:{kind:string}){
 return <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==="image"?<><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 18 6-6 4 4 3-4 5 6"/></>:kind==="heart"?<path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1C-1 10 12 21 12 21S25 10 20 5Z"/>:<><path d="m3 10 18-7-7 18-3-8-8-3Z"/><path d="m11 13 10-10"/></>}</svg>;
}
