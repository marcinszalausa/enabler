"use client";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { saveCreativePreferences, type PreferenceState } from "../../actions";
import type { CreativePreferences } from "@/lib/creative-preferences";
const field="w-full rounded-xl border border-line-strong bg-bg px-4 py-3 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/20";
export function PersonalizationForm({ productId, initial, audience, focus, required=false }: {
  productId:string;initial:CreativePreferences|null;audience:string;focus:string;required?:boolean;
}) {
 const {t}=useI18n(),router=useRouter();
 const [promotion,setPromotion]=useState(initial?.promotion??"product");
 const [offer,setOffer]=useState(initial?.offer??"");
 const [state,action,pending]=useActionState(async(prev:PreferenceState,form:FormData)=>{
   const result=await saveCreativePreferences(prev,form);
   if(result.saved){router.refresh();setTimeout(()=>document.getElementById("generate-ads")?.focus(),100);}
   return result;
 },{error:null,saved:false});
 return <section id="ad-preferences" className="mt-8 scroll-mt-24 rounded-2xl border border-line bg-raised p-5 sm:p-7">
   <details open={required}>
     <summary className="min-h-11 cursor-pointer py-2 text-lg font-semibold">{t.personal.title}</summary>
     <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{t.personal.intro}</p>
     <form action={action} className="mt-6 space-y-6" data-personalization-form>
       <input type="hidden" name="productId" value={productId}/>
       <fieldset><legend className="mb-3 text-sm font-medium">1. {t.personal.promotion}</legend>
         <div className="grid gap-2 sm:grid-cols-3">{(["product","collection","offer"] as const).map(value=>
           <label key={value} className={"flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-sm "+(promotion===value?"border-accent bg-accent-soft":"border-line")}>
             <input type="radio" name="promotion" value={value} checked={promotion===value} onChange={()=>setPromotion(value)} className="h-4 w-4 accent-accent"/>{t.personal[value]}
           </label>)}</div>
       </fieldset>
       {promotion==="offer"?<label className="block text-sm font-medium">{t.personal.offerDetails}
         <textarea name="offer" required maxLength={240} value={offer} onChange={event=>setOffer(event.target.value)} rows={2} className={field+" mt-2"}/>
         <span className="mt-2 block text-xs font-normal text-muted">{t.personal.offerHelp}</span>
       </label>:<input type="hidden" name="offer" value=""/>}
       <label className="block text-sm font-medium">2. {t.personal.audience}
         <textarea name="audience" required maxLength={240} defaultValue={initial?.audience??audience.slice(0,240)} rows={2} className={field+" mt-2"}/>
       </label>
       <label className="block text-sm font-medium">3. {t.personal.focus}
         <textarea name="focus" required maxLength={240} defaultValue={initial?.focus??focus.slice(0,240)} rows={2} className={field+" mt-2"}/>
       </label>
       <button type="submit" disabled={pending} className="btn-primary min-h-12 rounded-xl px-5 py-3 text-sm font-medium disabled:opacity-60">{pending?t.app.saving:t.personal.save}</button>
       {state.error&&<p role="alert" className="text-sm text-danger">{state.error}</p>}
     </form>
   </details>
   {initial&&<p className="mt-3 text-sm leading-relaxed text-muted">{initial.audience} · {initial.focus}</p>}
   {state.saved&&<p role="status" className="mt-3 text-sm text-ok">{t.personal.saved}</p>}
 </section>;
}
