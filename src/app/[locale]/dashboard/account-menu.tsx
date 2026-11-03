"use client";
import {useEffect,useRef} from "react";
import {useI18n} from "@/i18n/client";
export function AccountMenu(){
 const {t}=useI18n();const root=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{
  const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))root.current?.removeAttribute("open");};
  document.addEventListener("pointerdown",close);return()=>document.removeEventListener("pointerdown",close);
 },[]);
 return <details ref={root} className="relative" data-account-menu onKeyDown={event=>{if(event.key==="Escape"){event.currentTarget.open=false;event.currentTarget.querySelector("summary")?.focus();}}}>
  <summary className="flex min-h-11 min-w-11 cursor-pointer list-none flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] sm:flex-row sm:gap-1.5 sm:px-2 sm:text-sm font-medium hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent">
   <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>
   <span>{t.footer.account}</span>
  </summary>
  <div className="absolute end-0 top-full z-40 mt-2 w-48 rounded-xl border border-line bg-bg p-2 shadow-xl">
   <form action="/auth/signout" method="post"><button type="submit" className="flex min-h-11 w-full items-center rounded-lg px-3 text-start text-sm hover:bg-surface">{t.app.signOut}</button></form>
  </div>
 </details>;
}
