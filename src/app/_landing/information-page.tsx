import Link from "next/link";
import type { ReactNode } from "react";
import { Nav, Footer } from "./chrome";
import { localePath, type Locale } from "@/i18n/config";

export function InformationPage({children}:{children:ReactNode}) {
  return <div className="landing flex flex-1 flex-col bg-bg text-fg"><Nav/><main id="main-content" tabIndex={-1} className="min-w-0 flex-1">{children}</main><Footer/></div>;
}
export function InformationHero({eyebrow,title,description,locale,primaryAction}:{eyebrow:string;title:string;description:string;locale:Locale;primaryAction?:{href:string;label:string}}) {
  return <section className="hero-bg border-b border-line"><div className="mx-auto max-w-4xl px-4 py-14 text-center sm:py-20"><p className="text-sm font-medium text-accent">{eyebrow}</p><h1 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1><p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted">{description}</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link href={primaryAction?.href??localePath(locale,"/start")} prefetch={false} className="btn-primary inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-3 font-medium">{primaryAction?.label??"Try it with your product"}</Link><Link href={localePath(locale,"/use-cases")} prefetch={false} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line-strong bg-bg px-5 py-3 font-medium">See real examples →</Link></div></div></section>;
}
export function WorkflowIllustration({steps}:{steps:readonly string[]}) {
  return <ol className="mt-8 grid gap-4 sm:grid-cols-3" aria-label="How it works">{steps.map((step,i)=><li key={step} className="edge flex min-w-0 flex-col p-5"><div aria-hidden className="flex h-28 items-center justify-center rounded-xl bg-accent-soft text-accent"><svg viewBox="0 0 120 80" className="h-20 w-32" fill="none" stroke="currentColor" strokeWidth="2">{i===0?<><rect x="12" y="14" width="96" height="52" rx="8"/><path d="M12 28h96M26 21h4m5 0h4m5 0h4M30 43h60M30 54h38"/></>:i===1?<><rect x="18" y="10" width="48" height="60" rx="6"/><rect x="57" y="25" width="45" height="45" rx="6" fill="var(--t-bg)"/><path d="m27 48 10-10 19 19M65 57l10-12 18 17M28 21h28m-28 6h18"/><circle cx="50" cy="36" r="4"/></>:<><rect x="24" y="15" width="72" height="55" rx="7"/><path d="M24 30h72M41 8v15M79 8v15m-36 25 10 10 22-22"/></>}</svg></div><p className="mt-4 text-xs font-medium text-accent">Step {i+1}</p><p className="mt-1 font-medium">{step}</p></li>)}</ol>;
}
