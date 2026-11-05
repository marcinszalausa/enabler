"use client";
import {useEffect,useRef,type ReactNode} from "react";
import Link from "next/link";
import {localePath} from "@/i18n/config";
import {useI18n} from "@/i18n/client";
// The account at the bottom of the sidebar: who is signed in, and a menu that
// opens upward with Billing, policies and Sign out.
// `admin` is the Admin link, rendered on the server only for Gooidy admins.
export function AccountMenu({admin,email=""}:{admin?:ReactNode;email?:string}={}){
 const {t,locale}=useI18n();const root=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{
  const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))root.current?.removeAttribute("open");};
  document.addEventListener("pointerdown",close);return()=>document.removeEventListener("pointerdown",close);
 },[]);
 const initial=(email.trim()[0]??"").toUpperCase();
 return <details ref={root} className="group relative" data-account-menu onKeyDown={event=>{if(event.key==="Escape"&&event.currentTarget.open){event.preventDefault();event.currentTarget.open=false;event.currentTarget.querySelector("summary")?.focus();}}}>
  <summary title={email||undefined} className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-2xl border border-line px-3 py-2 text-start in-data-collapsed:justify-center in-data-collapsed:border-0 in-data-collapsed:px-0 transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent group-open:bg-surface">
   <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-fg">
    {initial||<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>}
   </span>
   <span className="min-w-0 flex-1 in-data-collapsed:hidden">
    <span className="block text-sm font-medium">{t.footer.account}</span>
    {email&&<span className="block truncate text-xs text-muted" dir="ltr">{email}</span>}
   </span>
   <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted transition group-open:rotate-180 in-data-collapsed:hidden" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>
  </summary>
  <div className="absolute inset-x-0 bottom-full z-40 mb-2 rounded-xl in-data-collapsed:end-auto in-data-collapsed:w-56 border border-line bg-bg p-2 shadow-xl">
   {admin}
   <Link href="/dashboard/billing" prefetch={false} className="flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-surface">{t.billing.nav}</Link>
   <Link href={localePath(locale,"/policies")} className="flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-surface">{t.legal.center}</Link>
   <form action="/auth/signout" method="post"><button type="submit" className="flex min-h-11 w-full items-center rounded-lg px-3 text-start text-sm hover:bg-surface">{t.app.signOut}</button></form>
  </div>
 </details>;
}
