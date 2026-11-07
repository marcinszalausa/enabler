import Link from "next/link";
import Image from "./ad-image";
import {Footer} from "./chrome";
import {PublicPricing} from "./public-pricing";
import {StudioMotion,StudioNav,StudioPlanner,StudioRail,StudioStart,StudioTransformation} from "./studio-interactions";
import {studioCopy} from "./studio-copy";
import {STUDIO_BRAND} from "@/lib/studio-showcase";
import {localePath,type Locale} from "@/i18n/config";
import type {Messages} from "@/i18n/messages";
import {fmt} from "@/i18n/format";
import {LANGUAGES,DEFAULT_VIDEO_OPTIONS} from "@/lib/video-options";
import {homeJsonLd} from "@/lib/seo";
import {PAID_PLANS} from "@/lib/paid-plans";
import "./studio-home.css";

function Arrow(){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M5 12h14m-5-5 5 5-5 5"/></svg>;}

export function StudioHome({locale,t}:{locale:Locale;t:Messages}){
 const c=studioCopy(locale,t);
 const counts={count:Object.keys(LANGUAGES).length,seconds:Number(DEFAULT_VIDEO_OPTIONS.length)};
 return <div className="studio-home flex flex-1 flex-col" data-studio-home>
  <StudioNav/>
  <main id="main-content" tabIndex={-1} className="flex-1">
   <section className="studio-hero" aria-labelledby="studio-hero-title">
    <div className="studio-hero-copy">
     <p className="studio-kicker"><span className="studio-kicker-dot" aria-hidden/>{c.eyebrow}</p>
     <h1 id="studio-hero-title"><span>{c.line1}</span><span>{c.line2}</span></h1>
     <p className="studio-hero-intro">{c.intro}</p>
     <StudioStart copy={c} id="create"/>
    </div>
    <StudioRail label={c.examples}/>
    <div className="studio-platforms"><span>{locale==="en"?"Made for where your customers scroll":t.home.whereTitle}</span><strong>Instagram</strong><strong>TikTok</strong><strong>Facebook</strong></div>
   </section>

   <section id="how" className="studio-section studio-how" data-studio-reveal>
    <div><h2>{c.sourceTitle}</h2><p className="studio-section-lede">{c.sourceBody}</p><Link href={localePath(locale,"/start")} className="studio-text-link" prefetch={false}>{c.sourceCta}<Arrow/></Link></div>
    <StudioTransformation copy={c}/>
   </section>

   <section className="studio-section studio-benefits" aria-labelledby="studio-benefits-title">
    <div className="studio-section-heading" data-studio-reveal><h2 id="studio-benefits-title">{c.benefitsTitle}</h2></div>
    <div className="studio-benefit-grid">
     <article className="studio-benefit-card studio-brand-card" data-studio-reveal>
      <h3>{c.brandTitle}</h3><p>{c.brandBody}</p>
      <div className="studio-brand-visual">
       <div className="studio-brand-ad"><Image src={STUDIO_BRAND} alt={locale==="en"?"Soft Mila cardigan ad using the brand's natural colors":t.home.kitTitle} fill sizes="(min-width:768px) 350px, 75vw" loading="lazy"/></div>
       <div className="studio-brand-kit"><div><strong>softmila</strong><span className="studio-brand-type" aria-hidden>Aa</span></div><div className="studio-palette" aria-label={locale==="en"?"Sage, cream, charcoal and warm gray brand colors":t.home.kitTitle}>{["#9da99b","#eae4d8","#33382f","#c3b9aa"].map(color=><span key={color} style={{background:color}}/>)}</div><small>{locale==="en"?"Example brand kit":t.home.kitTitle}</small></div>
      </div>
     </article>
     <article className="studio-benefit-card studio-schedule-card" data-studio-reveal><h3>{c.planTitle}</h3><p>{c.planBody}</p><StudioPlanner/></article>
    </div>
   </section>

   <section id="pricing" className="studio-section studio-pricing" aria-labelledby="studio-pricing-title" data-studio-reveal>
    <div className="studio-section-heading"><h2 id="studio-pricing-title">{c.pricingTitle}</h2><p>{c.pricingBody}</p></div>
    <PublicPricing compact/>
    <p className="studio-pricing-note" lang="en">One social account included. Extra connections and advertising budgets are separate.</p>
    <p className="studio-pricing-details"><Link href={localePath(locale,"/pricing")} className="studio-text-link" prefetch={false}>{c.pricingDetails}<Arrow/></Link></p>
   </section>

   <section id="faq" className="studio-section studio-faq" aria-labelledby="studio-faq-title" data-studio-reveal>
    <h2 id="studio-faq-title">{c.faqTitle}</h2>
    {t.home.faq.slice(0,4).map(item=><details key={item.q}><summary>{item.q}<span aria-hidden>+</span></summary><p>{fmt(item.a,counts)}</p></details>)}
   </section>

   <section className="studio-final" data-studio-reveal><h2>{c.finalTitle}</h2><Link href={localePath(locale,"/start")} className="studio-button" prefetch={false}>{c.create}<Arrow/></Link><p>{c.hint}</p></section>
  </main>
  <Footer/>
  <StudioMotion/>
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(homeJsonLd(locale,t.meta.description,PAID_PLANS.map(plan=>({name:plan.name,price:plan.price})))).replace(/</g,"\\u003c")}}/>
 </div>;
}
