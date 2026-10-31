"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {useI18n} from "@/i18n/client";
import {adChoicePath,readAdChoice,type AdChoice} from "@/lib/ad-choice";
export function ChosenAdResume({workspaceId,connected}:{workspaceId:string;connected:boolean}){
 const {t}=useI18n();const [choice,setChoice]=useState<AdChoice|null>(null);
 useEffect(()=>{try{setChoice(readAdChoice(window.sessionStorage,workspaceId));}catch{}},[workspaceId]);
 if(!choice)return null;
 return <aside data-chosen-ad-resume className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-accent/30 bg-accent-soft p-5">
 <div><h2 className="font-semibold">{t.choose.kept}</h2><p className="mt-1 max-w-xl text-sm text-muted">{connected?t.choose.resumeReady:t.choose.resumeConnect}</p></div>
 <Link href={adChoicePath(choice)} className="btn-primary min-h-11 content-center rounded-xl px-5 py-3 text-sm font-medium">{t.choose.return}</Link></aside>;
}
