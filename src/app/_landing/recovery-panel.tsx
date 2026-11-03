"use client";
import Link from "next/link";
import {useEffect,useRef,useTransition} from "react";
import {useI18n} from "@/i18n/client";
import {localePath} from "@/i18n/config";
import {CONTACT_EMAIL} from "@/lib/contact";

export function RecoveryPanel({retry,dashboard=false,title}:{retry:()=>void;dashboard?:boolean;title?:string}){
 const {locale,t}=useI18n();
 const heading=useRef<HTMLHeadingElement>(null);
 const [pending,startTransition]=useTransition();
 useEffect(()=>{heading.current?.focus();},[]);
 return <section data-recovery-panel aria-labelledby="recovery-title" aria-busy={pending} className="mx-auto w-full max-w-xl rounded-3xl border border-line bg-raised px-5 py-10 text-center shadow-sm sm:p-12">
   <span aria-hidden className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
     <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 7a7 7 0 0 1 11.5-1L20 9M4 15l2.4 3A7 7 0 0 0 18 17"/></svg>
   </span>
   <h1 id="recovery-title" ref={heading} tabIndex={-1} className="mt-6 text-2xl font-semibold tracking-tight outline-none sm:text-3xl">{title??t.recovery.title}</h1>
   <p className="mt-3 leading-relaxed text-muted">{t.recovery.body}</p>
   <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
     <button data-recovery-retry type="button" disabled={pending} onClick={()=>startTransition(retry)} className="btn-primary min-h-12 rounded-xl px-5 py-3 font-medium disabled:cursor-wait disabled:opacity-60">{pending?t.app.loading:t.library.retry}</button>
     <Link data-recovery-home href={dashboard?"/dashboard":localePath(locale,"/")} prefetch={false} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line px-5 py-3 font-medium hover:bg-surface">{dashboard?t.app.products:t.notFound.home}</Link>
   </div>
   <a href={`mailto:${CONTACT_EMAIL}`} className="mt-5 inline-flex min-h-11 flex-wrap items-center justify-center gap-x-2 rounded-lg px-2 text-sm text-accent underline-offset-4 hover:underline"><span>{t.footer.contact}</span><span>{CONTACT_EMAIL}</span></a>
 </section>;
}
