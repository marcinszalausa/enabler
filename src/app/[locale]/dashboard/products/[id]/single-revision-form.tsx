"use client";
import {useActionState,useState} from "react";
import {startSingleRevision} from "./single-revision-actions";
import {IMAGE_CREDITS,QUALITIES,type Quality} from "@/lib/quality";
import {creditsPerVideo,LENGTHS,type LengthKey} from "@/lib/video-options";
const field="min-h-11 w-full rounded-lg border border-line-strong bg-raised px-3 py-2";
export function SingleRevisionForm({creativeId,kind}:{creativeId:string;kind:"image"|"video"}){
 const [state,action,pending]=useActionState(startSingleRevision,{error:null,started:false});
 const [requestId,setRequestId]=useState("");const [quality,setQuality]=useState<Quality>(kind==="image"?"best":"better");const [length,setLength]=useState<LengthKey>("7");
 const cost=kind==="image"?IMAGE_CREDITS[quality]:creditsPerVideo(length,quality);
 return <details className="rounded-xl border border-line p-3" onToggle={e=>{if(e.currentTarget.open&&!requestId)setRequestId(crypto.randomUUID());}}><summary className="min-h-11 cursor-pointer text-sm font-medium">Recreate only this {kind}</summary><form action={action} className="mt-3 grid gap-3">
 <input type="hidden" name="creativeId" value={creativeId}/><input type="hidden" name="requestId" value={requestId}/><input type="hidden" name="quotedCost" value={cost}/>
 <label className="grid gap-1 text-sm">What should look different?<textarea className={field} name="direction" required maxLength={240} rows={3} placeholder="Example: Brighter daylight with a simple background. Keep the real product accurate."/></label>
 <label className="grid gap-1 text-sm">Quality<select className={field} name="quality" value={quality} onChange={e=>setQuality(e.target.value as Quality)}>{QUALITIES.map(q=><option key={q} value={q}>{q[0].toUpperCase()+q.slice(1)}</option>)}</select></label>
 {kind==="video"&&<label className="grid gap-1 text-sm">Length of the new video<select name="length" className={field} value={length} onChange={e=>setLength(e.target.value as LengthKey)}>{Object.keys(LENGTHS).map(l=><option key={l} value={l}>{l} seconds</option>)}</select></label>}
 <p className="text-sm font-medium" role="status">One new {kind} · {cost} credits</p><p className="text-xs leading-relaxed text-muted">Your original and the other ads stay available. {kind==="image"?"The new image keeps this format and wording, with a newly generated photo.":"This creates a new video, including its narration and on-screen text. People, motion and wording may change; it is not an edit of the existing video."} Quality checks still apply. Nothing is posted automatically by this revision.</p>
 <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmed" value="yes" required className="mt-1"/>Use {cost} credits for this single {kind}.</label>
 <button disabled={pending||state.started||!requestId} className="min-h-11 rounded-lg border border-line-strong px-3 text-sm font-medium">{pending?"Starting…":state.started?"Revision started":"Create one new "+kind}</button>{state.error&&<p role="alert" className="text-sm text-danger">{state.error}</p>}{state.started&&<p role="status" className="text-sm text-ok">Started. Check the new batch below for progress and its credit receipt.</p>}
 </form></details>;
}
