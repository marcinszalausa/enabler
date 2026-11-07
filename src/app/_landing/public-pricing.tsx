"use client";
import {storeConnectionFeature} from "@/lib/stores/copy";
import {useState} from "react";
import Link from "next/link";
import {useI18n} from "@/i18n/client";
import {localePath} from "@/i18n/config";
import {fmt} from "@/i18n/format";
import {PAID_PLANS} from "@/lib/paid-plans";
import {planTools} from "@/lib/plan-value";
import {PAID_CHECKOUT_STATUS} from "@/lib/legal-policy";
import {LANGUAGES} from "@/lib/video-options";
import {PACK_DISCOUNTS,YEARLY_DISCOUNT,yearlyPrice,usd,type Interval} from "@/lib/pricing";
import {LocalPrice} from "./local-price";

// Three paid plans with an optional one-time preview, a monthly/yearly switch
// above them, and "Everything in X, plus:" lists that only name what each
// step up adds. Prices and allowances come from the plan catalogue.
const LANGUAGE_COUNT=Object.keys(LANGUAGES).length;

// Rising bars, one more per plan: a small sign of growth, not a product claim.
function PlanIcon({level}:{level:number}){
 return <svg viewBox="0 0 32 32" aria-hidden className="h-9 w-9 text-accent" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
  {[0,1,2,3].map(i=><path key={i} d={`M${7+i*6} 26V${22-i*5}`} opacity={i<=level?1:.22}/>)}
  <path d="M4 28h24" opacity=".5"/>
 </svg>;
}

function Check(){return <svg viewBox="0 0 20 20" aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m4.5 10.5 3.5 3.5 7.5-8"/></svg>;}

export function PublicPricing({compact=false}:{compact?:boolean}={}){
 const {locale,t}=useI18n();const p=t.pricingPage;
 const [interval,setBilling]=useState<Interval>("month");
 const percent=Math.round(YEARLY_DISCOUNT*100);
 const cards=[
  ...PAID_PLANS.map(plan=>({id:plan.id,name:plan.name,tagline:p[plan.id].tagline,price:plan.price,credits:plan.credits,recommended:plan.recommended,features:locale==="en"?plan.highlights:p[plan.id].features,soon:"soonFeature" in p[plan.id]?(p[plan.id] as {soonFeature:string}).soonFeature:null})),
 ];
 return <div data-pricing-cards>
  {!compact&&<div className="flex justify-center">
   <div role="group" aria-label={p.monthly+" / "+p.yearly} data-billing-toggle className="inline-flex rounded-full border border-line bg-raised p-1 text-sm">
    {(["month","year"] as const).map(value=><button key={value} type="button" aria-pressed={interval===value} onClick={()=>setBilling(value)} className={"min-h-10 rounded-full px-4 font-medium transition "+(interval===value?"bg-accent text-accent-fg shadow-sm":"text-muted hover:text-fg")}>
     {value==="month"?p.monthly:<>{p.yearly}<span className={"ms-2 rounded-full px-2 py-0.5 text-xs "+(interval===value?"bg-white/20":"bg-accent-soft text-accent")}>{fmt(p.save,{percent})}</span></>}
    </button>)}
   </div>
  </div>}
  <div id="plans" data-public-plans className="mt-8 grid scroll-mt-24 items-stretch gap-4 md:grid-cols-3">
   {cards.map((card,level)=>{
    const tools=planTools(card.id),yearly=interval==="year"&&card.price>0;
    const shown=yearly?Math.round(yearlyPrice(card.price)/12*100)/100:card.price;
    const values={credits:card.credits.toLocaleString(locale),accounts:1,posts:tools.resultsLimit,languages:LANGUAGE_COUNT};
    const previous=level>0?cards[level-1].name:null;
    return <article key={card.id} id={"plan-"+card.id} data-plan={card.id} className={"relative flex min-w-0 scroll-mt-24 flex-col rounded-2xl border bg-raised p-6 "+(card.recommended?"border-accent shadow-[0_24px_70px_-42px_var(--t-accent)]":"border-line")}>
     <div className="flex items-start justify-between gap-2"><PlanIcon level={level}/>{card.recommended&&<span data-recommended-plan className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">{p.popular}</span>}</div>
     <h3 className="mt-5 text-2xl font-semibold tracking-tight">{card.name}</h3>
     <p className="mt-1 text-sm text-muted">{card.tagline}</p>
     <p className="mt-5 text-3xl font-semibold tracking-tight" data-price={shown}>{usd(shown,locale)}</p>
     <p className="mt-1 min-h-10 text-xs leading-relaxed text-muted">
      {yearly?fmt(p.perMonthYearly,{total:usd(yearlyPrice(card.price),locale),monthly:usd(card.price,locale)}):p.perMonth}
      {!compact&&card.price>0&&<LocalPrice usd={shown} locale={locale} template={" · "+t.home.approx} />}
     </p>
     <button type="button" data-buy-plan={card.id} disabled={PAID_CHECKOUT_STATUS==="unavailable"} title="Online payments are currently unavailable" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-medium text-muted opacity-60" lang="en">Buy {card.name}</button>
     <Link data-try-plan={card.id} href={localePath(locale,"/start")+"?"+new URLSearchParams({plan:card.id})} prefetch={false} className="mt-1 inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2 text-xs font-medium text-accent">{locale==="en"?"Explore first":p.cta}</Link>
     <div className="mt-6 flex-1 border-t border-line pt-5">
      {previous&&<p className="mb-3 text-sm font-semibold">{fmt(p.everythingIn,{plan:previous})}</p>}
      <ul data-plan-included={card.id} className="space-y-2.5 text-sm">
       {card.features.map((feature,i)=><li key={feature} className="flex gap-2.5"><Check/><span className={i===0?"font-semibold":""}>{fmt(feature,values)}</span></li>)}
       {locale!=="en"&&card.id==="plus"&&<li className="flex gap-2.5"><Check/><span>{storeConnectionFeature(locale)}</span></li>}
       {card.price>0&&PACK_DISCOUNTS[card.id as keyof typeof PACK_DISCOUNTS]>0&&<li className="flex gap-2.5"><Check/><span>{fmt(p.packOff,{percent:Math.round(PACK_DISCOUNTS[card.id as keyof typeof PACK_DISCOUNTS]*100)})}</span></li>}
       {!compact&&card.soon&&<li className="flex gap-2.5"><Check/><span>{card.soon} <span className="ms-1 whitespace-nowrap rounded-md border border-line px-1.5 py-0.5 text-[11px] font-medium text-muted">{p.soon}</span></span></li>}
      </ul>
     </div>
    </article>;
   })}
  </div>
 </div>;
}
