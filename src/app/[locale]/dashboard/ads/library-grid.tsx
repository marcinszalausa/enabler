"use client";
import {useEffect,useRef,useState} from "react";
import { sizeLabel } from "@/lib/create-options";
import Link from "next/link";
import {useI18n} from "@/i18n/client";
import {type LibraryAd} from "@/lib/ad-library";
import {adChoicePath} from "@/lib/ad-choice";
import {FavoriteButton} from "./favorite-button";
import {DeleteDialog,TrashIcon} from "../delete-button";
import {MoreMenu} from "../more-menu";
import {DownloadIcon} from "../ui";
const preview=(ad:LibraryAd)=>"/api/creatives/"+ad.id+"/image?preview=1&layout=face-aware-v2&v="+ad.imageVersion;
const original=(ad:LibraryAd)=>"/api/creatives/"+ad.id+"/"+(ad.kind==="video"?"video":"image")+"?download=1&layout=face-aware-v2";
const review=(ad:LibraryAd)=>adChoicePath({workspaceId:ad.workspaceId,productId:ad.productId,generationId:ad.generationId,creativeId:ad.id,savedAt:0});
export function LibraryGrid({ads}:{ads:LibraryAd[]}){
 const {t,locale}=useI18n();const [selected,setSelected]=useState<LibraryAd|null>(null);const [removed,setRemoved]=useState<string[]>([]);const [confirm,setConfirm]=useState<string|null>(null);
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(selected&&!dialog.current?.open)dialog.current?.showModal();if(!selected&&dialog.current?.open)dialog.current.close();},[selected]);
 return <><ul data-library-grid className="mt-6 grid grid-cols-1 gap-5 min-[360px]:grid-cols-2 lg:grid-cols-3">
  {ads.filter(ad=>!removed.includes(ad.id)).map(ad=><li key={ad.id} data-library-ad={ad.id} className="relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-raised">
   <button type="button" data-library-preview onClick={()=>setSelected(ad)} aria-label={t.app.preview+": "+(ad.headline??ad.productName)} className="flex h-64 w-full items-center justify-center bg-surface p-3 focus-visible:outline-2 focus-visible:outline-accent">
    {ad.kind==="image"?
    // eslint-disable-next-line @next/next/no-img-element -- bounded authenticated image preview
    <img src={preview(ad)} alt={ad.headline??ad.productName} loading="lazy" className="h-full w-full object-contain"/>:
    <span className="flex flex-col items-center gap-3 text-accent"><svg viewBox="0 0 24 24" className="h-14 w-14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m10 7 7 5-7 5V7Z" fill="currentColor" stroke="none"/></svg><span className="text-sm font-medium">{t.library.previewVideo}</span></span>}
   </button>
   <div className="flex flex-1 flex-col gap-3 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted"><span>{ad.kind==="video"?t.library.videos:sizeLabel(ad.aspect,t.app)}</span><time dateTime={ad.createdAt}>{new Date(ad.createdAt).toLocaleDateString(locale,{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"})}</time></div>
    <p className="line-clamp-2 break-words text-base font-semibold">{ad.headline??ad.productName}</p>
    <Link href={"/dashboard/products/"+ad.productId} className="truncate text-sm text-muted hover:text-accent">{ad.productName}</Link>
    <div className="mt-auto flex flex-wrap gap-2"><Link href={review(ad)} className="btn-primary inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-medium">{t.library.open}</Link><a href={original(ad)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line px-3 text-sm"><DownloadIcon/>{t.app.download}</a><MoreMenu className="relative ms-auto" items={[{label:t.remove.deleteAd,onSelect:()=>setConfirm(ad.id),danger:true,icon:<TrashIcon/>,testId:"delete-ad"}]}/></div>
    <FavoriteButton creativeId={ad.id} favorite={ad.favorite} overlay className="absolute end-3 top-3"/>

   </div>
  </li>)}
 </ul>
 {confirm&&<DeleteDialog target="ad" id={confirm} onClose={()=>setConfirm(null)} onDeleted={()=>setRemoved(r=>[...r,confirm])}/>}
 <dialog ref={dialog} aria-label={t.app.preview} onClose={()=>setSelected(null)} onClick={e=>{if(e.target===dialog.current)dialog.current.close();}} className="m-auto max-h-[90vh] w-[min(42rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-line bg-bg p-4 text-fg backdrop:bg-black/60 sm:p-6">
  {selected&&<><div className="flex items-start justify-between gap-3"><h2 className="break-words text-lg font-semibold">{selected.headline??selected.productName}</h2><button type="button" onClick={()=>dialog.current?.close()} aria-label={t.app.cancel} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-line text-xl">×</button></div>
   <div className="mt-4 flex justify-center rounded-xl bg-surface p-2">{selected.kind==="video"?<video key={selected.id} src={"/api/creatives/"+selected.id+"/video"} controls autoPlay playsInline preload="none" className="max-h-[60vh] max-w-full object-contain"/>:
   // eslint-disable-next-line @next/next/no-img-element -- private bounded preview
   <img src={preview(selected)} alt={selected.headline??selected.productName} className="max-h-[60vh] max-w-full object-contain"/>}</div>
   <p className="mt-4 whitespace-pre-line break-words text-sm">{selected.caption}</p>
   <div className="mt-4 flex flex-wrap gap-3"><Link href={review(selected)} className="btn-primary inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-medium">{t.library.open}</Link><a href={original(selected)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm"><DownloadIcon/>{t.app.download}</a></div>
  </>}
 </dialog></>;
}
