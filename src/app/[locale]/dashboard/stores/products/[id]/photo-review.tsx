"use client";
import {useState} from "react";
import type {PhotoReport,PhotoVerdict} from "@/lib/catalog/photo-check";

const labels:Record<PhotoVerdict,string>={usable:"Meets size and uniqueness checks",small:"Too small · use a larger original",duplicate:"Duplicate or very similar photo",unreadable:"Couldn’t read this photo",not_checked:"Not checked · check limit reached"};
const errors:Record<string,string>={ACCESS_DENIED:"Ask the workspace owner to open this product from a connected store on Grow or Scale.",PHOTOS_CHANGED:"The store photos changed during this check. Refresh this page before checking again.",CHECK_BUSY:"Please wait a minute before checking again.",CHECK_UNAVAILABLE:"We couldn’t finish the check. Please try again.",INVALID_REQUEST:"Refresh this page and try again."};
export function PhotoReview({itemId,images}:{itemId:string;images:string[]}){
 const [report,setReport]=useState<PhotoReport|null>(null),[pending,setPending]=useState(false),[error,setError]=useState("");
 async function check(){
  setPending(true);setError("");setReport(null);
  try{
   const response=await fetch("/api/catalog/photos/check",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({itemId}),signal:AbortSignal.timeout(60000)}),data=await response.json();
   if(!response.ok){setError(errors[data.code]??errors.CHECK_UNAVAILABLE);return;}setReport(data.report);
  }catch{setError(errors.CHECK_UNAVAILABLE);}finally{setPending(false);}
 }
 return <section aria-labelledby="photo-check-heading" data-catalog-photo-review className="edge mt-8 p-5 sm:p-8">
  <h2 id="photo-check-heading" className="text-xl font-semibold">Start with clear product photos</h2>
  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">For a product-specific model, use at least 10 different photos, each at least 768 × 768 pixels. Show the same product from several angles, with close-ups of its details.</p>
  <div className="mt-5 grid gap-3 sm:grid-cols-3">{[["↗","Different angles","Front, back and sides"],["⌕","Clear details","Texture, shape and finish"],["✓","The same product","One design and color"]].map(([icon,title,body])=><div key={title} className="rounded-xl border border-line p-4"><span aria-hidden="true" className="text-2xl text-accent">{icon}</span><h3 className="mt-2 text-sm font-medium">{title}</h3><p className="mt-1 text-xs text-muted">{body}</p></div>)}</div>
  <button type="button" onClick={check} disabled={pending||images.length===0} aria-describedby="photo-check-cost" className="mt-6 min-h-12 rounded-xl bg-accent px-5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40">{pending?"Checking your photos…":"Check product photos"}</button>
  <p id="photo-check-cost" className="mt-2 text-xs text-muted">No credits used. This checks photos only; it does not start training.</p>
  <div role="status" aria-live="polite" className="mt-4 text-sm">
   {pending&&<p className="text-muted">Checking size, readability and duplicates. This can take up to a minute.</p>}
   {error&&<p className="rounded-xl border border-line p-4">{error}</p>}
   {report&&<div data-photo-summary className="rounded-xl border border-line bg-surface p-4"><p className="font-semibold">Suitable photos: {report.usable} · Minimum: {report.minimum}</p><p className="mt-2 text-muted">{report.ready?"Ready for a visual review. Check that every photo shows the correct product, color and details.":`Add or replace photos in your store, then sync again. You need at least ${Math.max(0,report.minimum-report.usable)} more suitable photos.`}</p>{!report.complete&&<p className="mt-2 text-muted">Some photos were not checked because the check reached its processing limit.</p>}<p className="mt-2 text-xs text-muted">Size and duplicate checks do not verify product accuracy or guarantee the quality of a trained model.</p></div>}
  </div>
  {images.length===0?<p className="mt-5 text-sm text-muted">No photos were imported. Add photos to this product in your store, then sync again.</p>:<ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{images.map((url,index)=>{const result=report?.photos.find(p=>p.index===index);return <li key={index} className="min-w-0 overflow-hidden rounded-xl border border-line">
   {/* eslint-disable-next-line @next/next/no-img-element -- merchant catalog hosts vary; keep their photos outside the optimizer. */}
   <img src={url} alt={"Product photo "+(index+1)} width={240} height={280} loading="lazy" referrerPolicy="no-referrer" className="aspect-[6/7] w-full bg-surface object-contain"/>
   <div className="p-3"><p className="text-sm font-medium">Photo {index+1}</p><p data-photo-verdict className="mt-1 text-xs leading-relaxed text-muted">{result?labels[result.status]:"Not checked yet"}</p>{result?.width&&result?.height&&<p className="mt-1 text-xs text-muted">{result.width} × {result.height}</p>}</div>
  </li>;})}</ul>}
 </section>;
}
