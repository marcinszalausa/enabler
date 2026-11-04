"use client";
import {useState} from "react";
import Link from "next/link";
import {useI18n} from "@/i18n/client";
import {localePath} from "@/i18n/config";
import {TRY_MODE} from "@/lib/paid-plans";
import {PUBLIC_PLANS} from "@/lib/public-information";
import {QUALITIES,IMAGE_CREDITS,type Quality} from "@/lib/quality";
import {IDEA_COUNTS,imageRunCost,type IdeaCount} from "@/lib/image-pricing";
import {LENGTHS,videoRunCost,type LengthKey} from "@/lib/video-options";

const included=[
 "Product-page import and brand brief",
 "Image and video generation at your chosen quality",
 "Saved logo, colors, font and brand voice",
 "Campaign plans and creative starting points",
 "Free headline, button and post-caption edits",
 "Up to 3 free image redos per month for product mismatches",
 "Video narration, captions and music",
 "Image and MP4 downloads",
 "Posting calendar, queue and scheduled publishing",
 "Weekly planner and calendar reminders",
 "Network post results where analytics access is available",
];
export function PublicPricing(){
 const {locale}=useI18n();
 return <><div id="plans" data-public-plans className="scroll-mt-24 mt-10 grid items-stretch gap-5 md:grid-cols-3">{PUBLIC_PLANS.map(plan=><article id={"plan-"+plan.id} key={plan.id} data-plan={plan.id} className={"flex min-w-0 scroll-mt-24 flex-col rounded-2xl border bg-raised p-5 sm:p-6 "+(plan.recommended?"border-accent shadow-[0_20px_70px_-40px_var(--t-accent)]":"border-line")}>
 <div className="flex min-h-8 flex-wrap items-center justify-between gap-2"><h3 className="text-xl font-semibold">{plan.name}</h3>{plan.recommended&&<span data-recommended-plan className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">Recommended</span>}</div>
 <p className="mt-4 text-xl font-semibold leading-snug md:min-h-14">{plan.outcome}</p><p className="mt-2 text-sm text-muted md:min-h-12">{plan.forWhom}</p>
 <p className="mt-5"><span className="text-5xl font-semibold tracking-tight">${plan.price}</span><span className="ms-2 text-sm text-muted">USD / month</span></p>
 <button type="button" data-buy-plan={plan.id} disabled aria-describedby="purchase-status" title="Purchases are currently unavailable" className="mt-6 inline-flex min-h-12 cursor-not-allowed items-center justify-center rounded-xl border border-line-strong bg-surface px-4 py-3 text-center font-medium text-muted opacity-60">Buy {plan.name}</button>
 <Link data-try-plan={plan.id} href={localePath(locale,"/start")+"?"+new URLSearchParams({plan:plan.id})} prefetch={false} className="mt-2 inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-accent underline-offset-4 hover:underline">Try for free</Link>
 <p className="mt-1 text-center text-xs text-muted">No card needed to try</p>
 <div className="mt-6 flex-1 border-t border-line pt-5">
 <h4 id={"included-"+plan.id} className="font-semibold">What’s included</h4>
 <p className="mt-1 text-xs font-medium text-accent">{plan.upgrade}</p>
 <ul data-plan-included={plan.id} aria-labelledby={"included-"+plan.id} className="mt-4 space-y-3 text-sm">{[...new Set([...plan.highlights,...included])].map(feature=><li key={feature} className="flex gap-2"><span className="text-accent" aria-hidden>✓</span><span>{feature}</span></li>)}</ul>
 </div>
 </article>)}</div><p id="purchase-status" className="mt-4 text-center text-xs text-muted">Purchases are currently unavailable. You can still try for free.</p><section id="plan-free" data-try-mode className="mt-6 scroll-mt-24 rounded-2xl border border-line bg-surface p-5 sm:p-6"><h3 className="font-semibold">Prefer to explore first?</h3><p className="mt-2 text-sm leading-relaxed text-muted">The free preview uses {TRY_MODE.credits} one-time starter credits shared across your account. Choosing another plan does not refill them. No subscription starts automatically.</p><details className="mt-3"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">What is included for free?</summary><p className="pb-3 text-sm leading-relaxed text-muted">Try the core ad-creation workflow and download your results. Your selected plan is a preference, not paid access. Monthly credit allowances and paid planning or reporting tools begin only after paid activation. Existing accounts keep their current credits and access.</p></details><p className="mt-2 text-xs leading-relaxed text-muted">Each new paid plan includes one social account. Additional connections are optional and separately priced before activation. Paid advertising budgets are separate.</p></section><section data-shared-plan-features className="mt-6 rounded-2xl border border-line p-5 sm:p-6"><h3 className="font-semibold">Billing and plan details</h3><p data-money-back className="mt-3 text-sm text-muted">30-day money-back on your first monthly subscription payment. <Link href={localePath(locale,"/policies/billing")} prefetch={false} className="underline underline-offset-4">See refund terms</Link></p><Link href={localePath(locale,"/pricing#full-plan-comparison")} prefetch={false} className="mt-5 inline-flex min-h-11 items-center text-sm font-medium text-accent">See every feature and limit →</Link></section></>;
}
export function PlanComparison(){return <section id="compare-plan-features" className="mt-12 scroll-mt-24"><h2 className="text-2xl font-semibold">Choose how you want to grow</h2><div className="mt-6 grid gap-4 sm:grid-cols-3">{[["Starter","Keep a posting routine","Create ads in your saved brand style and plan what to post next."],["Plus","Learn from the response","Add more generation allowance, post comparisons and downloadable reports."],["Growth","Run more creative tests","Get the largest allowance and a wider view of recent post results."]].map(([name,title,body])=><article key={name} className="edge min-w-0 p-5"><p className="text-xs font-medium text-accent">{name}</p><h3 className="mt-2 font-semibold">{title}</h3><p className="mt-3 text-sm leading-relaxed text-muted">{body}</p></article>)}</div></section>;}
export function CreditCalculator(){
 const {t}=useI18n();const [kind,setKind]=useState("image");const [quality,setQuality]=useState<Quality>("good");const [ideas,setIdeas]=useState<IdeaCount>(1);const [length,setLength]=useState<LengthKey>("7");
 const cost=kind==="image"?imageRunCost(quality,ideas):videoRunCost(length,quality),outputs=kind==="image"?ideas*2:2;
 const select="min-h-11 w-full rounded-lg border border-line-strong bg-bg px-3 py-2";
 return <section id="credit-calculator" data-credit-calculator className="edge mt-12 scroll-mt-24 p-5 sm:p-7"><div className="max-w-2xl"><h2 className="text-2xl font-semibold">What can my credits make?</h2><p className="mt-3 text-sm leading-relaxed text-muted">Choose an example batch. The cost comes from the same pricing rules used when you create ads. This calculator does not spend credits.</p></div><div className="mt-6 grid gap-4 sm:grid-cols-3"><label className="grid gap-2 text-sm font-medium">Ad type<select aria-label="Ad type" className={select} value={kind} onChange={e=>setKind(e.target.value)}><option value="image">Image ads</option><option value="video">Video ads</option></select></label><label className="grid gap-2 text-sm font-medium">Quality<select aria-label="Quality" className={select} value={quality} onChange={e=>setQuality(e.target.value as Quality)}>{QUALITIES.map(q=><option key={q} value={q}>{t.app.qualities[q]}</option>)}</select></label>{kind==="image"?<label className="grid gap-2 text-sm font-medium">Images in a batch<select aria-label="Images in a batch" className={select} value={ideas} onChange={e=>setIdeas(Number(e.target.value) as IdeaCount)}>{IDEA_COUNTS.map(n=><option key={n} value={n}>{n*2} images · {n} {n===1?"idea":"ideas"}, two sizes each</option>)}</select></label>:<label className="grid gap-2 text-sm font-medium">Length per video<select aria-label="Length per video" className={select} value={length} onChange={e=>setLength(e.target.value as LengthKey)}>{(Object.keys(LENGTHS) as LengthKey[]).map(l=><option key={l} value={l}>{l} seconds</option>)}</select></label>}</div>
 <p className="mt-6 rounded-xl bg-accent-soft p-4 text-lg font-semibold text-accent" role="status" data-batch-price>{outputs} {kind==="image"?"images":"videos"} = {cost} credits per batch</p>
 <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[TRY_MODE,...PUBLIC_PLANS].map(p=>{const batches=Math.floor(p.credits/cost);return <div key={p.id} data-credit-capacity={p.id} className="rounded-xl border border-line p-4"><h3 className="font-medium">{p.name} · {p.credits} credits</h3><p className="mt-2 text-xl font-semibold">{batches*outputs} {kind==="image"?"images":"videos"}</p><p className="mt-1 text-xs text-muted">{batches} complete {batches===1?"batch":"batches"}; {p.credits-batches*cost} credits left</p></div>;})}</div>
 <p className="mt-5 text-xs leading-relaxed text-muted">These examples use the entire allowance for the selected type and quality. You can mix images and videos. Credits pay for generation; advertising spend on social networks is separate. Failed or undelivered outputs are settled through the credit refund system.</p>
 </section>;
}
