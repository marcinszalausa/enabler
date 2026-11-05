import type {Metadata} from "next";
import {Suspense} from "react";
import Link from "next/link";
import {notFound} from "next/navigation";
import {InformationPage} from "@/app/_landing/information-page";
import {isLocale,localePath} from "@/i18n/config";
import {PAID_PLANS,paidPlan} from "@/lib/paid-plans";

export const metadata:Metadata={title:"Your plan · Gooidy",robots:{index:false,follow:false}};
export default function CheckoutPage({params,searchParams}:PageProps<"/[locale]/checkout">){
 return <InformationPage><Suspense fallback={<p className="p-8 text-sm text-muted">Loading your plan…</p>}><Order params={params} searchParams={searchParams}/></Suspense></InformationPage>;
}
async function Order({params,searchParams}:PageProps<"/[locale]/checkout">){
 const {locale}=await params;if(!isLocale(locale))notFound();
 const query=await searchParams,id=paidPlan(query.plan);if(!id)notFound();
 const plan=PAID_PLANS.find(p=>p.id===id)!;
 return <section lang="en" data-purchase-plan={id} className="mx-auto max-w-xl px-4 py-12 sm:py-16">
  <Link href={localePath(locale,"/pricing")} className="inline-flex min-h-11 items-center text-sm text-accent">← Compare plans</Link>
  <h1 className="mt-4 text-3xl font-semibold">Your {plan.name} plan</h1>
  <p className="mt-3 text-muted">{plan.outcome}. No free preview is required.</p>
  <div className="mt-7 rounded-2xl border border-line bg-raised p-6">
   <p className="text-4xl font-semibold">${plan.price}<span className="ms-2 text-sm font-normal text-muted">USD / month</span></p>
   <p className="mt-3 text-sm text-muted">A recurring monthly subscription. Review taxes, the total and cancellation terms before authorizing payment.</p>
   <ul className="mt-6 space-y-3 text-sm">{plan.highlights.map(feature=><li key={feature} className="flex gap-2"><span aria-hidden className="text-accent">✓</span>{feature}</li>)}</ul>
   <p className="mt-5 text-xs leading-relaxed text-muted">One social account included. Optional extra connections are separately priced. Advertising budgets are separate.</p>
  </div>
  <div data-purchase-unavailable role="status" className="mt-5 rounded-xl border border-line bg-surface p-5">
   <h2 className="font-semibold">Online payments are currently unavailable</h2>
   <p className="mt-2 text-sm leading-relaxed text-muted">No payment has been taken and no subscription has started. Contact us for help with your selected plan.</p>
   <a href={"mailto:hello@gooidy.com?subject="+encodeURIComponent("Gooidy "+plan.name+" plan purchase")} className="btn-primary mt-4 inline-flex min-h-12 items-center justify-center rounded-xl px-5 py-3 font-medium">Contact us about {plan.name}</a>
  </div>
  <p className="mt-5 text-sm text-muted">Want to explore the generator instead? <Link data-optional-preview href={localePath(locale,"/start")+"?"+new URLSearchParams({plan:id})} prefetch={false} className="inline-flex min-h-11 items-center font-medium text-accent underline-offset-4 hover:underline">Try for free</Link></p>
  <div className="mt-5 flex flex-wrap gap-4 text-sm"><Link href={localePath(locale,"/policies/billing")} className="underline">Billing and refunds</Link><Link href={localePath(locale,"/terms")} className="underline">Terms</Link><Link href={localePath(locale,"/privacy")} className="underline">Privacy</Link></div>
 </section>;
}
