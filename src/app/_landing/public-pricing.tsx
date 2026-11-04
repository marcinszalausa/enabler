"use client";
import {useState} from "react";
import Link from "next/link";
import {useI18n} from "@/i18n/client";
import {localePath} from "@/i18n/config";
import {PUBLIC_PLANS} from "@/lib/public-information";
import {QUALITIES,IMAGE_CREDITS,type Quality} from "@/lib/quality";
import {IDEA_COUNTS,imageRunCost,type IdeaCount} from "@/lib/image-pricing";
import {LENGTHS,videoRunCost,type LengthKey} from "@/lib/video-options";

const included=["Image and video generation using your credits","Saved logo, colors, font and brand voice","Campaign plans and seasonal ideas","Free image-text and post-caption edits","Image and MP4 downloads","Posting calendar and scheduled publishing","Network results where analytics access is available"];
export function PublicPricing(){
 const {t,locale}=useI18n();
 return <div data-public-plans className="mt-10 grid items-stretch gap-5 md:grid-cols-3">{PUBLIC_PLANS.map((plan,i)=><article key={plan.id} data-plan={plan.id} className={"flex min-w-0 flex-col rounded-2xl border bg-raised p-6 "+(i===1?"border-accent shadow-[0_20px_70px_-40px_var(--t-accent)]":"border-line")}>
  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xl font-semibold">{t.home.plans[i].name}</h3>{i===1&&<span className="rounded-full bg-accent-soft px-2 py-1 text-xs font-medium text-accent">For regular campaigns</span>}</div>
  <p className="mt-3 min-h-10 text-sm text-muted">{plan.forWhom}</p>
  <p className="mt-5"><span className="text-5xl font-semibold tracking-tight">${plan.price}</span><span className="ms-2 text-sm text-muted">USD{plan.price>0?t.home.perMonth:""}</span></p>
  <p className="mt-3 font-medium text-accent">{t.home.plans[i].credits}</p>
  <p className="mt-2 text-xs leading-relaxed text-muted">{plan.price===0?"One starter allowance, with no automatic refill. No card needed.":"Monthly credit allowance; generation uses credits from your balance."}</p>
  <Link href={localePath(locale,plan.price===0?"/start":"/policies/billing")} prefetch={false} className={(i===1?"btn-primary":"border border-line-strong hover:bg-surface")+" mt-5 inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-3 text-center text-sm font-medium"}>{plan.price===0?t.nav.getStarted:t.legal.billing}</Link>
  <ul className="mt-6 flex-1 space-y-3 text-sm"><li className="flex gap-2"><span className="text-accent" aria-hidden>✓</span><span><strong>{Math.floor(plan.credits/IMAGE_CREDITS.best)}–{Math.floor(plan.credits/IMAGE_CREDITS.good)} images</strong> if all credits go to images, depending on quality</span></li><li className="flex gap-2"><span className="text-accent" aria-hidden>✓</span><span><strong>{plan.accounts} connected social {plan.accounts===1?"account":"accounts"}</strong></span></li>{included.map(feature=><li key={feature} className="flex gap-2"><span className="text-accent" aria-hidden>✓</span><span>{feature}</span></li>)}</ul>
 </article>)}</div>;
}
export function CreditCalculator(){
 const {t}=useI18n();const [kind,setKind]=useState("image");const [quality,setQuality]=useState<Quality>("good");const [ideas,setIdeas]=useState<IdeaCount>(1);const [length,setLength]=useState<LengthKey>("7");
 const cost=kind==="image"?imageRunCost(quality,ideas):videoRunCost(length,quality),outputs=kind==="image"?ideas*2:2;
 const select="min-h-11 w-full rounded-lg border border-line-strong bg-bg px-3 py-2";
 return <section id="credit-calculator" data-credit-calculator className="edge mt-12 p-5 sm:p-7"><div className="max-w-2xl"><h2 className="text-2xl font-semibold">What can my credits make?</h2><p className="mt-3 text-sm leading-relaxed text-muted">Choose an example batch. The cost comes from the same pricing rules used when you create ads. This calculator does not spend credits.</p></div><div className="mt-6 grid gap-4 sm:grid-cols-3"><label className="grid gap-2 text-sm font-medium">Ad type<select aria-label="Ad type" className={select} value={kind} onChange={e=>setKind(e.target.value)}><option value="image">Image ads</option><option value="video">Video ads</option></select></label><label className="grid gap-2 text-sm font-medium">Quality<select aria-label="Quality" className={select} value={quality} onChange={e=>setQuality(e.target.value as Quality)}>{QUALITIES.map(q=><option key={q} value={q}>{t.app.qualities[q]}</option>)}</select></label>{kind==="image"?<label className="grid gap-2 text-sm font-medium">Images in a batch<select aria-label="Images in a batch" className={select} value={ideas} onChange={e=>setIdeas(Number(e.target.value) as IdeaCount)}>{IDEA_COUNTS.map(n=><option key={n} value={n}>{n*2} images · {n} {n===1?"idea":"ideas"}, two sizes each</option>)}</select></label>:<label className="grid gap-2 text-sm font-medium">Length per video<select aria-label="Length per video" className={select} value={length} onChange={e=>setLength(e.target.value as LengthKey)}>{(Object.keys(LENGTHS) as LengthKey[]).map(l=><option key={l} value={l}>{l} seconds</option>)}</select></label>}</div>
 <p className="mt-6 rounded-xl bg-accent-soft p-4 text-lg font-semibold text-accent" role="status" data-batch-price>{outputs} {kind==="image"?"images":"videos"} = {cost} credits per batch</p>
 <div className="mt-5 grid gap-3 sm:grid-cols-3">{PUBLIC_PLANS.map((p,i)=>{const batches=Math.floor(p.credits/cost);return <div key={p.id} data-credit-capacity={p.id} className="rounded-xl border border-line p-4"><h3 className="font-medium">{t.home.plans[i].name} · {p.credits} credits</h3><p className="mt-2 text-xl font-semibold">{batches*outputs} {kind==="image"?"images":"videos"}</p><p className="mt-1 text-xs text-muted">{batches} complete {batches===1?"batch":"batches"}; {p.credits-batches*cost} credits left</p></div>;})}</div>
 <p className="mt-5 text-xs leading-relaxed text-muted">These examples use the entire allowance for the selected type and quality. You can mix images and videos. Credits pay for generation; advertising spend on social networks is separate. Failed or undelivered outputs are settled through the credit refund system.</p>
 </section>;
}
