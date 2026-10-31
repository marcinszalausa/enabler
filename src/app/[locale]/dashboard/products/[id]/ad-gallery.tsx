"use client";
import {useState} from "react";
import {useAdChoice,notifyAdChoice} from "../../use-ad-choice";
import {useI18n} from "@/i18n/client";
import {fmt} from "@/i18n/format";
import {rememberAdChoice} from "@/lib/ad-choice";
import {PublishOneButton} from "./publish-dialog";
import {DownloadIcon,smallButton} from "../../ui";
import type {Creative,AdPost} from "./generation-block";
import {platformName} from "@/lib/social/platforms";
export function AdGallery({creatives,generationId,imageVersion,seconds,canPublish=false,workspaceId,productId,posts}:{
 creatives:Creative[];generationId:string;imageVersion:string;seconds:number;canPublish?:boolean;
 workspaceId?:string;productId?:string;posts:Record<string,AdPost>;
}){
 const {t}=useI18n();const [selectedId,setSelectedId]=useState<string|null>(null);
 const {choice,favorite}=useAdChoice(workspaceId);
 const selected=creatives.find(c=>c.id===selectedId)??creatives.find(c=>c.id===favorite)??creatives.find(c=>choice?.generationId===generationId&&c.id===choice.creativeId)??creatives[0];
 function remember(id:string){
  if(!workspaceId||!productId)return;
  try{rememberAdChoice(window.sessionStorage,{workspaceId,productId,generationId,creativeId:id});notifyAdChoice();}catch{}
 }
 if(!selected)return null;
 const post=posts[selected.id],video=selected.kind==="video";
 return <div data-ad-gallery className="mt-5 rounded-2xl border border-line bg-raised p-4 sm:p-6">
 <h3 className="text-xl font-semibold">{t.choose.title}</h3><p className="mt-1 max-w-xl text-sm text-muted">{t.choose.help}</p>
 <div className="mt-5 grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
  <div data-selected-preview className="flex min-h-40 min-w-0 justify-center rounded-xl bg-surface p-3">
   {video?<video key={selected.id} src={`/api/creatives/${selected.id}/video`} controls playsInline preload="metadata" className="max-h-[65vh] w-auto max-w-full rounded-lg object-contain"/>:
   // eslint-disable-next-line @next/next/no-img-element -- authenticated bounded preview, full original only on download
   <img src={`/api/creatives/${selected.id}/image?preview=1&layout=face-safe-v1&v=${imageVersion}`} alt={selected.headline??t.choose.title} className="max-h-[65vh] w-auto max-w-full rounded-lg object-contain"/>}
  </div>
  <div className="min-w-0">
   <p className="text-xs text-muted">{video?fmt(t.app.reel,{seconds}):selected.aspect==="1:1"?t.app.feedSize:t.app.storySize}</p>
   {selected.headline&&<p className="mt-2 break-words text-lg font-semibold">{selected.headline}</p>}
   <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-muted">{selected.primary_text}</p>
   {post&&<p data-selected-post-status className={"mt-4 text-sm "+(post.status==="published"?"text-ok":post.status==="failed"||post.status==="partial"?"text-danger":"text-accent")}>{t.publish.status[post.status]}{post.platforms.length>0&&" · "+post.platforms.map(platformName).join(", ")}{post.when&&" · "+post.when}</p>}
   <div className="mt-5 flex flex-wrap items-center gap-3">
    {canPublish&&<PublishOneButton generationId={generationId} creativeId={selected.id} primary onPrepare={()=>remember(selected.id)}/>}
    <a href={`/api/creatives/${selected.id}/${video?"video":"image"}?download=1&layout=face-safe-v1`} className={smallButton}><DownloadIcon/>{video?t.app.downloadMp4:t.app.download}</a>
   </div>
   <div className="mt-6 grid grid-cols-4 gap-2 sm:grid-cols-5" aria-label={t.choose.title} data-ad-choices>{creatives.map((c,i)=><button key={c.id} type="button" aria-pressed={c.id===selected.id} aria-label={fmt(t.choose.preview,{number:i+1})} onClick={()=>{setSelectedId(c.id);remember(c.id);}} className={"relative min-w-0 overflow-hidden rounded-lg border-2 bg-surface p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent "+(c.id===selected.id?"border-accent":"border-transparent hover:border-line-strong")}>
     {c.kind==="video"?<video src={`/api/creatives/${c.id}/video`} muted playsInline preload="metadata" className="aspect-[4/5] w-full object-contain"/>:
     // eslint-disable-next-line @next/next/no-img-element -- bounded private thumbnails
     <img src={`/api/creatives/${c.id}/image?preview=1&layout=face-safe-v1&v=${imageVersion}`} alt="" loading="lazy" className="aspect-[4/5] w-full object-contain"/>}
     <span className="absolute end-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-raised text-xs font-medium">{c.id===selected.id?"✓":i+1}</span>
   </button>)}</div>
  </div>
 </div></div>;
}
