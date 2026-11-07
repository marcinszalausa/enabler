"use client";
import {storeConnectionFeature} from "@/lib/stores/copy";
import {useState} from "react";
import Link from "next/link";
import {useI18n} from "@/i18n/client";
import {localePath} from "@/i18n/config";
import {fmt} from "@/i18n/format";
import {PAID_PLANS} from "@/lib/paid-plans";
import {creditExamples} from "@/lib/credit-examples";
import {creditExampleCopy} from "@/lib/credit-example-copy";
import {planTools} from "@/lib/plan-value";
import {pricingDisplayCopy} from "@/lib/pricing-display-copy";
import {PAID_CHECKOUT_STATUS} from "@/lib/legal-policy";
import {LANGUAGES} from "@/lib/video-options";
import {PACK_DISCOUNTS,YEARLY_DISCOUNT,yearlyPrice,usd,type Interval} from "@/lib/pricing";
import {LocalPrice} from "./local-price";

const LANGUAGE_COUNT=Object.keys(LANGUAGES).length;
const EN_FEATURES={starter:["Branded image and video ads","Weekly posting planner","Scheduled publishing"],plus:["Connect your store and import products","Compare up to {posts} recent posts","Download results as a CSV report"],growth:["Compare up to {posts} recent posts","Next-test action plan from your results","Download your next-campaign brief"]};
function PlanIcon({level}:{level:number}){
 return <svg data-plan-icon={level} viewBox="0 0 24 24" aria-hidden className="h-6 w-6 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
  {level===0?<path d="M8 4.5a1 1 0 0 1 1.5-.86l11 7.5a1 1 0 0 1 0 1.72l-11 7.5A1 1 0 0 1 8 19.5z"/>:level===1?<><path d="M4 20v-5m5 5v-8m5 8V9m5 11V5M4 10l5-4 5 1 6-5M15 2h5v5"/></>:<><rect x="3" y="8" width="13" height="13" rx="2"/><path d="M8 5V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-1"/></>}
 </svg>;
}
function BenefitIcon({index}:{index:number}){return <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{index===0?<path d="m12 3 9 5-9 5-9-5 9-5zm-9 9 9 5 9-5m-18 5 9 5 9-5"/>:index===1?<path d="m4 16 12-12a2 2 0 0 1 3 3L7 19l-4 1 1-4zm10-10 4 4"/>:index===2?<path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5"/>:<><circle cx="12" cy="7" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></>}</svg>;}
function Check(){return <svg viewBox="0 0 20 20" aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m4.5 10.5 3.5 3.5 7.5-8"/></svg>;}

export function PublicPricing({compact=false}:{compact?:boolean}={}){
 const {locale,t}=useI18n(),p=t.pricingPage,copy=pricingDisplayCopy(locale),examplesCopy=creditExampleCopy(locale);
 const [interval,setBilling]=useState<Interval>("month");
 const percent=Math.round(YEARLY_DISCOUNT*100),unavailable=PAID_CHECKOUT_STATUS==="unavailable";
 return <div data-pricing-cards>
  {!compact&&<div className="flex justify-center"><div role="group" aria-label={p.monthly+" / "+p.yearly} data-billing-toggle className="inline-flex rounded-full border border-line bg-raised p-1 text-sm">
   {(["month","year"] as const).map(value=><button key={value} type="button" aria-pressed={interval===value} onClick={()=>setBilling(value)} className={"min-h-10 rounded-full px-4 font-medium transition "+(interval===value?"bg-fg text-bg":"text-muted hover:text-fg")}>{value==="month"?p.monthly:<>{p.yearly}<span className="ms-2 text-xs">{fmt(p.save,{percent})}</span></>}</button>)}
  </div></div>}
  <div id="plans" data-public-plans className="mt-7 grid scroll-mt-24 items-stretch gap-4 md:grid-cols-3">
   {PAID_PLANS.map((card,level)=>{
    const tools=planTools(card.id),yearly=interval==="year",shown=yearly?Math.round(yearlyPrice(card.price)/12*100)/100:card.price;
    const values={credits:card.credits.toLocaleString(locale),accounts:1,posts:tools.resultsLimit,languages:LANGUAGE_COUNT};
    const example=creditExamples(card.credits),exampleValues={images:example.images.toLocaleString(locale),videos:example.videos.toLocaleString(locale),seconds:example.seconds};
    const previous=level>0?PAID_PLANS[level-1].name:null,features=locale==="en"?EN_FEATURES[card.id]:p[card.id].features.slice(1);
    return <article key={card.id} id={"plan-"+card.id} data-plan={card.id} className={"relative flex min-w-0 scroll-mt-24 flex-col rounded-2xl border bg-raised p-6 sm:p-7 "+(card.recommended?"border-accent/40":"border-line")}>
     <div className="flex min-h-7 items-center justify-between gap-2"><PlanIcon level={level}/>{card.recommended&&<span data-recommended-plan className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent">{locale==="en"?"Recommended":p.popular}</span>}</div>
     <h3 className="mt-5 text-2xl font-semibold tracking-tight">{card.name}</h3>
     <p data-plan-tagline className="mt-1 min-h-10 text-sm leading-5 text-muted">{locale==="en"?card.outcome:p[card.id].tagline}</p>
     <p className="mt-5 text-[2.75rem] leading-none font-semibold tracking-[-0.055em]" data-price={shown}>{usd(shown,locale)}</p>
     <p className="mt-2 min-h-10 text-xs leading-relaxed text-muted">{yearly?fmt(p.perMonthYearly,{total:usd(yearlyPrice(card.price),locale),monthly:usd(card.price,locale)}):p.perMonth}{!compact&&<LocalPrice usd={shown} locale={locale} template={" · "+t.home.approx}/>}</p>
     <p data-plan-credits className="mt-1 text-sm font-medium">{fmt(copy.credits,values)}</p>
     <p data-credit-example className="mt-2 min-h-10 text-xs leading-5 text-muted">{fmt(examplesCopy.example,exampleValues)}</p>
     <button type="button" data-buy-plan={card.id} disabled={unavailable} title={unavailable?"Online payments are currently unavailable":undefined} className={"mt-6 inline-flex min-h-12 items-center justify-center rounded-full px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 "+(unavailable?"border border-line bg-surface text-muted":card.recommended?"bg-accent text-accent-fg":"bg-fg text-bg")} lang="en">Choose {card.name}</button>
     <div className="mt-6 flex-1 border-t border-line pt-5">
      <p className="mb-4 min-h-10 text-xs leading-5 font-medium">{previous?fmt(p.everythingIn,{plan:previous}):locale==="en"?"Create and publish":"Launch"}</p>
      <ul data-plan-included={card.id} className="space-y-3 text-sm leading-relaxed">
       {features.map(feature=><li key={feature} className="flex gap-2.5"><Check/><span>{fmt(feature,values)}</span></li>)}
       {locale!=="en"&&card.id==="plus"&&<li className="flex gap-2.5"><Check/><span>{storeConnectionFeature(locale)}</span></li>}
       <li className="flex gap-2.5"><Check/><span>{fmt(p.packOff,{percent:Math.round(PACK_DISCOUNTS[card.id]*100)})}</span></li>
      </ul>
     </div>
    </article>;
   })}
  </div>
  <section data-shared-plan-benefits className="mt-4 rounded-2xl border border-line bg-raised px-5 py-5 sm:px-6 lg:flex lg:items-center lg:gap-7">
   <h3 className="shrink-0 text-sm font-semibold tracking-tight">{copy.shared}</h3>
   <ul className="mt-4 grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-4 lg:mt-0 lg:grid-cols-4 lg:border-s lg:border-line lg:ps-7">
    {copy.benefits.map((benefit,i)=><li key={benefit} className="flex min-w-0 items-center gap-2.5 text-xs leading-5"><BenefitIcon index={i}/><span>{benefit}</span></li>)}
   </ul>
  </section>
  <p data-pricing-note className="mx-auto mt-4 max-w-2xl text-center text-xs leading-relaxed text-muted">{copy.note}</p>
  <details data-credit-example-details className="mx-auto mt-2 max-w-2xl text-center text-xs text-muted"><summary className="inline-flex min-h-11 cursor-pointer items-center gap-2">{examplesCopy.title}<span aria-hidden>+</span></summary><p className="pb-3 text-start leading-relaxed">{examplesCopy.body}</p></details>
  <div data-pricing-preview className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
   <Link data-try-plan="starter" href={localePath(locale,"/start")+"?plan=starter"} prefetch={false} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent">{copy.preview}<span aria-hidden>→</span></Link>
   <span className="text-xs text-muted">{copy.previewNote}</span>
  </div>
 </div>;
}

