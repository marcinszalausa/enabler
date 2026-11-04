"use client";
import {useActionState} from "react";
import {useI18n} from "@/i18n/client";
import {setFavorite} from "./actions";
export function FavoriteButton({creativeId,favorite,overlay=false,className}:{creativeId:string;favorite:boolean;overlay?:boolean;className?:string}){
 const {t}=useI18n();
 const [state,action,pending]=useActionState(setFavorite,{favorite,error:null});
 return <form action={action} className={className??"min-w-0"} data-favorite-form>
  <input type="hidden" name="creativeId" value={creativeId}/>
  <input type="hidden" name="favorite" value={state.favorite?"0":"1"}/>
  {overlay?
  // Floating heart on the preview, like photo and shopping apps.
  <button type="submit" disabled={pending} aria-pressed={state.favorite} aria-label={state.favorite?t.library.unsave:t.library.save} title={state.favorite?t.library.unsave:t.library.save} className={"flex h-11 w-11 items-center justify-center rounded-full border border-line/60 bg-bg/85 shadow-sm backdrop-blur transition hover:scale-105 active:scale-95 disabled:opacity-60 "+(state.favorite?"text-accent":"text-fg")}>
   <svg viewBox="0 0 24 24" className="h-5 w-5" fill={state.favorite?"currentColor":"none"} stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1C-1 10 12 21 12 21S25 10 20 5Z"/></svg>
  </button>:
  <button type="submit" disabled={pending} aria-pressed={state.favorite} aria-label={state.favorite?t.library.unsave:t.library.save} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-medium hover:border-accent disabled:opacity-60">
   <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-accent" fill={state.favorite?"currentColor":"none"} stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1C-1 10 12 21 12 21S25 10 20 5Z"/></svg>
   {pending?t.app.saving:state.favorite?t.library.saved:t.library.save}
  </button>}
  {state.error&&<p role="alert" className={overlay?"mt-1 max-w-40 rounded-lg bg-bg/95 px-2 py-1 text-xs text-danger shadow":"mt-2 text-sm text-danger"}>{state.error}</p>}
 </form>;
}
