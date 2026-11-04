"use client";
import {useActionState,useState} from "react";
import type {Creative} from "./generation-block";
import {saveAdCopy} from "./revision-actions";
import {createCampaign} from "../../campaigns/actions";
const input="min-h-11 w-full rounded-lg border border-line-strong bg-raised px-3 py-2 font-normal";
export function AdRevisions({creative,productId}:{creative:Creative;productId:string}){
 const [state,action,pending]=useActionState(saveAdCopy,{error:null,saved:false});
 const [sceneState,sceneAction,scenePending]=useActionState(createCampaign,{error:null});
 const [revisionId,setRevisionId]=useState("");
 return <div className="mt-5 grid gap-3">
  <details className="rounded-xl border border-line p-3"><summary className="min-h-11 cursor-pointer text-sm font-medium">Edit {creative.kind==="video"?"post caption":"headline and caption"} · no credits</summary><form action={action} className="mt-3 grid gap-3">
   <input type="hidden" name="creativeId" value={creative.id}/><input type="hidden" name="version" value={JSON.stringify([creative.headline,creative.primary_text,creative.cta])}/>
   {creative.kind==="image"&&<><label className="grid gap-1 text-sm">Headline<input className={input} name="headline" required maxLength={100} defaultValue={creative.headline??""}/></label><label className="grid gap-1 text-sm">Button label<input className={input} name="cta" required maxLength={24} defaultValue={creative.cta??""}/></label></>}
   <label className="grid gap-1 text-sm">Post caption<textarea className={input} name="primary_text" required maxLength={2000} rows={4} defaultValue={creative.primary_text??""}/></label>
   <p className="text-xs text-muted">{creative.kind==="video"?"Video narration and on-screen text are already rendered; this changes the caption used for future posts.":"The photo stays the same. The updated headline and button keep face-aware placement."} Existing scheduled and published posts stay as they were. Check that your claims are accurate.</p>
   <button disabled={pending} className="min-h-11 rounded-lg border border-line-strong px-3 text-sm font-medium">{pending?"Saving…":"Save text changes"}</button>{state.saved&&<p role="status" className="text-sm text-ok">Saved. No credits used.</p>}{state.error&&<p role="alert" className="text-sm text-danger">{state.error}</p>}
  </form></details>
  <details className="rounded-xl border border-line p-3" onToggle={event=>{if(event.currentTarget.open&&!revisionId)setRevisionId(crypto.randomUUID());}}><summary className="min-h-11 cursor-pointer text-sm font-medium">Try a different scene</summary><form action={sceneAction} className="mt-3 grid gap-3">
   <input type="hidden" name="id" value={revisionId}/><input type="hidden" name="productId" value={productId}/><input type="hidden" name="goal" value="introduce"/><input type="hidden" name="offer" value=""/><input type="hidden" name="name" value={"New scene: "+(creative.headline??"Product ad").slice(0,65)}/><label className="grid gap-1 text-sm">Message to keep<textarea name="message" required maxLength={240} defaultValue={(creative.headline??creative.primary_text??"Show the product’s verified benefits").slice(0,240)} className={input}/></label><p className="text-xs text-muted">Check that any offer is still valid and include its conditions before continuing.</p>
   <label className="grid gap-1 text-sm">What should look different?<input name="scene" required maxLength={240} placeholder="Example: Brighter daylight, a simple studio background" className={input}/></label>
   <p className="text-xs text-muted">Keep this ad and create a new batch with your scene direction. Next you choose images or video and see the full credit cost. Saving this direction uses no credits.</p>
   <button disabled={scenePending||!revisionId} className="min-h-11 rounded-lg border border-line-strong px-3 text-sm font-medium">{scenePending?"Saving…":"Save direction and see generation options"}</button>{sceneState.error&&<p role="alert" className="text-sm text-danger">{sceneState.error}</p>}
  </form></details>
 </div>;
}
