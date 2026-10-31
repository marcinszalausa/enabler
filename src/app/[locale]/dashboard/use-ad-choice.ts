"use client";
import {useSyncExternalStore} from "react";
import {AD_CHOICE_KEY,parseAdChoice} from "@/lib/ad-choice";
export const AD_CHOICE_EVENT="gooidy:ad-choice";
function subscribe(callback:()=>void){window.addEventListener("storage",callback);window.addEventListener("popstate",callback);window.addEventListener(AD_CHOICE_EVENT,callback);return ()=>{window.removeEventListener("storage",callback);window.removeEventListener("popstate",callback);window.removeEventListener(AD_CHOICE_EVENT,callback);};}
function snapshot(){let raw:string|null=null;try{raw=window.sessionStorage.getItem(AD_CHOICE_KEY);}catch{}return JSON.stringify([raw,window.location.search]);}
const serverSnapshot=()=>"[null,\"\"]";
export function notifyAdChoice(){window.dispatchEvent(new Event(AD_CHOICE_EVENT));}
export function useAdChoice(workspaceId?:string){
 const raw=useSyncExternalStore(subscribe,snapshot,serverSnapshot);
 const [stored,search]=JSON.parse(raw) as [string|null,string];
 return {choice:workspaceId?parseAdChoice(stored,workspaceId):null,favorite:new URLSearchParams(search).get("favorite")};
}
