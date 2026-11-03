import type {Messages} from "@/i18n/messages";
export function ProductJourney({t,needsPreferences=false,hasAds=false,running=false,posted=false,canEdit=true}:{t:Messages;needsPreferences?:boolean;hasAds?:boolean;running?:boolean;posted?:boolean;canEdit?:boolean}){
 const current=needsPreferences?1:running?2:hasAds?3:2;
 const label=posted?t.choose.viewPosts:!canEdit?t.app.preview:needsPreferences?t.personal.title:running?t.run.check:hasAds?t.choose.title:t.journey.create;
 const href=posted?"/dashboard/publishing":!canEdit?"#your-ads":needsPreferences?"#ad-preferences":running||hasAds?"#your-ads":"#generate-ads";
 const hint=posted?t.publish.posts:!canEdit?t.run.readyBody:needsPreferences?t.personal.intro:running?t.run.working:hasAds?t.choose.help:t.journey.start;
 return <section data-product-journey className="mt-6 rounded-2xl border border-line bg-raised p-4 sm:p-5">
  <ol className="grid grid-cols-4 gap-2" aria-label={t.onboard.title}>
   {[t.journey.product,t.journey.direction,t.journey.create,t.journey.pick].map((step,i)=><li key={step} aria-current={i===current&&!posted?"step":undefined} className="flex min-w-0 flex-col items-center gap-2 text-center text-xs sm:text-sm">
    <span aria-hidden="true" className={"flex h-9 w-9 items-center justify-center rounded-xl font-semibold "+(i<current||posted?"bg-accent-soft text-accent":i===current?"bg-accent text-accent-fg":"bg-surface text-muted")}>{i<current||posted?"✓":i+1}</span><span className={i===current?"font-medium":"text-muted"}>{step}</span>
   </li>)}
  </ol>
  <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
   <div><p className="text-xs font-medium text-muted">{t.journey.title}</p><p className="mt-1 max-w-xl text-sm">{hint}</p></div>
   <a data-next-step href={href} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent-soft px-4 py-2 text-sm font-medium text-accent hover:border-accent">{label}<span aria-hidden="true" className="rtl:-scale-x-100">→</span></a>
  </div>
 </section>;
}
