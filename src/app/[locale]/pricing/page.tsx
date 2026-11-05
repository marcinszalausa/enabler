import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import {isLocale,localePath} from "@/i18n/config";
import {getMessages} from "@/i18n/messages";
import {fmt} from "@/i18n/format";
import {pageMetadata} from "@/lib/seo";
import {InformationPage} from "@/app/_landing/information-page";
import {PublicPricing} from "@/app/_landing/public-pricing";
import {IMAGE_CREDITS,VIDEO_CREDITS_PER_SECOND} from "@/lib/quality";
import {LANGUAGES} from "@/lib/video-options";
import {MAX_PACK_DISCOUNT,MONEY_BACK_DAYS,PACK_CREDITS,PACK_PRICES,YEARLY_DISCOUNT,usd} from "@/lib/pricing";

// Pricing laid out like a plan picker: the plan cards first, short footnotes
// under them, then credit packs, what every plan covers and a short FAQ.
export async function generateMetadata({params}:PageProps<"/[locale]/pricing">):Promise<Metadata>{
 const {locale}=await params;if(!isLocale(locale))return {};
 const t=await getMessages(locale);
 return pageMetadata(locale,"/pricing",t.pricingPage.metaTitle,t.pricingPage.metaDescription);
}

const VALUES={imageMin:IMAGE_CREDITS.good,imageMax:IMAGE_CREDITS.best,videoMin:VIDEO_CREDITS_PER_SECOND.good,videoMax:VIDEO_CREDITS_PER_SECOND.best,days:MONEY_BACK_DAYS,percent:Math.round(YEARLY_DISCOUNT*100),languages:Object.keys(LANGUAGES).length};
const JOURNEY_ICONS=[
 <path key="c" d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>,
 <g key="e"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></g>,
 <g key="p"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M9 15l2 2 4-4"/></g>,
 <path key="a" d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>,
];

export default async function Pricing({params}:PageProps<"/[locale]/pricing">){
 const {locale}=await params;if(!isLocale(locale))notFound();
 const t=await getMessages(locale),p=t.pricingPage;
 const faq=p.faq.map(item=>({q:item.q,a:fmt(item.a,VALUES)}));
 const structured=JSON.stringify({"@context":"https://schema.org","@type":"FAQPage",mainEntity:faq.map(item=>({"@type":"Question",name:item.q,acceptedAnswer:{"@type":"Answer",text:item.a}}))}).replace(/</g,"\\u003c");
 return <InformationPage>
  <script type="application/ld+json" data-pricing-structured dangerouslySetInnerHTML={{__html:structured}}/>
  <section className="hero-bg border-b border-line">
   <div className="mx-auto max-w-7xl px-4 pb-14 pt-12 sm:pt-16">
    <h1 className="text-center text-4xl font-semibold tracking-tight sm:text-5xl">{p.title}</h1>
    <p className="mx-auto mt-4 max-w-xl text-center text-lg text-muted">{p.sub}</p>
    <div className="mt-8"><PublicPricing/></div>
    <div data-pricing-footnotes className="mx-auto mt-8 max-w-3xl space-y-1.5 text-center text-xs leading-relaxed text-muted">
     {p.footnotes.map(note=><p key={note}>{fmt(note,VALUES)}</p>)}
    </div>
   </div>
  </section>
  <section id="packs" data-credit-packs className="mx-auto max-w-5xl scroll-mt-24 px-4 pt-16">
   <div className="grid items-center gap-6 rounded-2xl border border-line bg-raised p-6 md:grid-cols-[1.2fr_1fr] sm:p-8">
    <div><h2 className="text-2xl font-semibold tracking-tight">{p.packsTitle}</h2><p className="mt-2 text-sm leading-relaxed text-muted">{p.packsSub}</p><ul className="mt-3 space-y-1 text-sm text-muted"><li data-pack-discount className="font-medium text-accent">{fmt(p.packsDiscount,{percent:Math.round(MAX_PACK_DISCOUNT*100)})}</li><li>{p.packsAuto}</li></ul></div>
    <div className="grid gap-3 sm:grid-cols-2">
     {(["small","large"] as const).map(key=><div key={key} data-pack={key} className="rounded-xl border border-line bg-surface p-4">
      <p className="text-sm font-medium">{fmt(p.pack,{count:PACK_CREDITS[key].toLocaleString(locale)})}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{usd(PACK_PRICES[key],locale)}</p>
     </div>)}
    </div>
   </div>
  </section>
  <section data-plan-journey className="mx-auto max-w-5xl px-4 pt-16">
   <h2 className="text-center text-2xl font-semibold tracking-tight">{p.journeyTitle}</h2>
   <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {p.journey.map((stage,i)=><li key={stage.name} className="min-w-0 rounded-2xl border border-line bg-raised p-5">
     <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent"><svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{JOURNEY_ICONS[i]}</svg></span>
     <h3 className="mt-4 font-semibold">{stage.name}</h3>
     <p className="mt-1.5 text-sm leading-relaxed text-muted">{fmt(stage.body,VALUES)}</p>
    </li>)}
   </ol>
  </section>
  <section className="mx-auto max-w-3xl px-4 py-16">
   <h2 className="text-center text-2xl font-semibold tracking-tight">{p.faqTitle}</h2>
   <div data-pricing-faq className="mt-8 divide-y divide-line border-y border-line">
    {faq.map(item=><details key={item.q} className="group py-2"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-3 font-medium">{item.q}<svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-muted transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path d="M6 9l6 6 6-6"/></svg></summary><p className="pb-4 text-sm leading-relaxed text-muted">{item.a}</p></details>)}
   </div>
   <p className="mt-6 text-center"><Link href={localePath(locale,"/policies/billing")} prefetch={false} className="inline-flex min-h-11 items-center text-sm font-medium text-accent">{p.billingLink} →</Link></p>
  </section>
 </InformationPage>;
}
