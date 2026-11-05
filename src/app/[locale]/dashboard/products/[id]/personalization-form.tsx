"use client";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { saveCreativePreferences, type PreferenceState } from "../../actions";
import type { CreativePreferences } from "@/lib/creative-preferences";
const field="w-full rounded-xl border border-line-strong bg-raised px-4 py-3 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/20";
export function PersonalizationForm({ productId, initial, audience, focus, benefits=[], required=false }: {
  productId:string;initial:CreativePreferences|null;audience:string;focus:string;benefits?:string[];required?:boolean;
}) {
 const {t}=useI18n(),router=useRouter();
 const [promotion,setPromotion]=useState(initial?.promotion??"product");
 const [audienceValue,setAudience]=useState(initial?.audience??audience.slice(0,240));
 const [focusValue,setFocus]=useState(initial?.focus??focus.slice(0,240));
 const suggestions=[...new Set(benefits.map(value=>value.trim().slice(0,240)).filter(Boolean))].slice(0,3);
 const [offer,setOffer]=useState(initial?.offer??"");
 const [open,setOpen]=useState(required);
 const [state,action,pending]=useActionState(async(prev:PreferenceState,form:FormData)=>{
   const result=await saveCreativePreferences(prev,form);
   if(result.saved){setOpen(false);router.refresh();setTimeout(()=>document.getElementById("generate-ads")?.focus(),100);}
   return result;
 },{error:null,saved:false});
 const summary=initial?[initial.promotion==="offer"&&initial.offer?initial.offer:null,initial.audience,initial.focus].filter(Boolean).join(" · "):`${audience} · ${focus}`;
 return <section id="ad-preferences" tabIndex={-1} className="scroll-mt-40 rounded-xl bg-surface focus:outline-2 focus:outline-accent" data-ad-direction>
   {!open&&<div className="flex min-h-14 items-center gap-3 px-4 py-3">
     <TargetIcon/>
     <div className="min-w-0 flex-1"><p className="text-sm font-medium">{t.journey.direction}</p><p className="truncate text-sm text-muted" title={summary}>{summary}</p></div>
     <button type="button" onClick={()=>setOpen(true)} aria-expanded={false} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-sm font-medium text-accent hover:underline">{t.app.edit}</button>
   </div>}
   {open&&<div className="p-4 sm:p-5">
     <div className="flex items-start gap-3"><TargetIcon/><div className="min-w-0 flex-1"><p className="font-medium">{t.personal.title}</p>
     <p className="mt-1 text-sm leading-relaxed text-muted">{t.personal.intro}</p></div>
     {!required&&<button type="button" onClick={()=>setOpen(false)} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-sm text-muted hover:text-fg">{t.app.cancel}</button>}</div>
     <form action={action} className="mt-6 space-y-6" data-personalization-form>
       <input type="hidden" name="productId" value={productId}/>
       <fieldset><legend className="mb-3 text-sm font-medium">1. {t.personal.promotion}</legend>
         <div className="grid grid-cols-3 gap-2">{(["product","collection","offer"] as const).map(value=>
           <label key={value} className={"relative flex cursor-pointer flex-col items-center gap-3 rounded-xl border p-3 text-center text-sm transition focus-within:ring-2 focus-within:ring-accent "+(promotion===value?"border-accent bg-accent-soft":"border-line bg-raised")}>
             <PromotionPicture kind={value}/><input type="radio" name="promotion" value={value} checked={promotion===value} onChange={()=>setPromotion(value)} className="absolute end-2 top-2 h-4 w-4 accent-accent"/><span className="break-words font-medium">{t.personal[value]}</span>
           </label>)}</div>
       </fieldset>
       {promotion==="offer"?<label className="block text-sm font-medium">{t.personal.offerDetails}
         <textarea name="offer" placeholder={t.personal.offerExample} required maxLength={240} value={offer} onChange={event=>setOffer(event.target.value)} rows={2} className={field+" mt-2"}/>
         <span className="mt-2 block text-xs font-normal text-muted">{t.personal.offerHelp}</span>
       </label>:<input type="hidden" name="offer" value=""/>}
       <label className="block text-sm font-medium"><span className="flex items-center gap-2"><PeoplePicture/>2. {t.personal.audience}</span>
         <textarea name="audience" required maxLength={240} value={audienceValue} onChange={event=>setAudience(event.target.value)} rows={2} className={field+" mt-2"}/>
       </label>
       <fieldset><legend className="mb-3 text-sm font-medium">3. {t.personal.focus}</legend>
         {suggestions.length>0&&<div className="mb-3 flex flex-wrap gap-2" data-benefit-choices>{suggestions.map(value=><button key={value} type="button" aria-pressed={focusValue===value} onClick={()=>setFocus(value)} className={"min-h-11 max-w-full rounded-xl border px-4 py-3 text-start text-sm "+(focusValue===value?"border-accent bg-accent-soft":"border-line bg-raised hover:border-accent")}>
           <span aria-hidden="true" className="me-2 text-accent">{focusValue===value?"✓":"+"}</span>{value}
         </button>)}</div>}
       <label className="block text-sm font-medium"><span className="sr-only">{t.personal.focus}</span>
         <textarea name="focus" required maxLength={240} value={focusValue} onChange={event=>setFocus(event.target.value)} rows={2} className={field+" mt-2"}/>
       </label>
       </fieldset>
       <figure className="flex min-w-0 items-center gap-4 rounded-xl border border-line bg-raised p-4" data-direction-preview>
         <div className="flex h-28 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-line-strong bg-accent-soft p-1 shadow-sm"><PromotionPicture kind={promotion}/></div>
         <div className="min-w-0"><figcaption className="text-xs font-medium text-muted">{t.personal.preview}</figcaption>
           <p className="mt-1 break-words text-base font-semibold">{focusValue}</p>
           <p className="mt-1 flex items-start gap-2 break-words text-sm text-muted"><PeoplePicture/>{audienceValue}</p>
           {promotion==="offer"&&offer&&<p className="mt-2 break-words text-sm font-medium text-accent">{offer}</p>}
         </div>
       </figure>
       <button type="submit" disabled={pending} className="btn-primary min-h-12 w-full rounded-xl px-5 py-3 text-sm font-medium disabled:opacity-60">{pending?t.app.saving:t.personal.save}</button>
       {state.error&&<p role="alert" className="text-sm text-danger">{state.error}</p>}
     </form>
   </div>}
   {state.saved&&!open&&<p role="status" className="px-4 pb-3 text-sm text-ok">{t.personal.saved}</p>}
 </section>;
}

function PromotionPicture({kind}:{kind:CreativePreferences["promotion"]}){
 return <svg viewBox="0 0 96 72" className="h-16 w-full max-w-24 text-accent" fill="none" aria-hidden="true">
   {kind==="offer"?<><path d="M18 14h35l27 23-32 28-30-27V14Z" fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth="2"/><circle cx="29" cy="25" r="3" fill="currentColor"/><path d="m42 31 15 15m-12-1h.1m9-13h.1" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></>:
   <>{kind==="collection"&&<><rect x="5" y="25" width="26" height="38" rx="5" fill="currentColor" fillOpacity=".1" stroke="currentColor" strokeWidth="2"/><rect x="65" y="25" width="26" height="38" rx="5" fill="currentColor" fillOpacity=".1" stroke="currentColor" strokeWidth="2"/></>}
   <rect x="28" y="20" width="40" height="45" rx="6" fill="currentColor" fillOpacity=".15" stroke="currentColor" strokeWidth="2"/>
   <path d="M38 25V17a10 10 0 0 1 20 0v8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
   <path d="m41 43 5 5 10-12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></>}
 </svg>;
}
function PeoplePicture(){
 return <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 5a5 5 0 0 1 3 5"/></svg>;
}

function TargetIcon(){
 return <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>;
}
