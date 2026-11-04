"use client";
import {useState} from "react";
import {useI18n} from "@/i18n/client";
import type {PostRow} from "./publishing-view";
export function PostingCalendar({posts,timeZone,now}:{posts:PostRow[];timeZone:string;now:string}){
 const {t,locale}=useI18n();
 const [offset,setOffset]=useState(0);
 const key=(date:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
 const today=key(new Date(now));
 const start=new Date(today+"T12:00:00Z");start.setUTCDate(start.getUTCDate()-start.getUTCDay()+offset*7);
 const days=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setUTCDate(d.getUTCDate()+i);return d;});
 return <section className="edge p-5 sm:p-6" data-posting-calendar><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Posting calendar</h2><p className="mt-1 text-xs text-muted">{timeZone} · latest {posts.length} posts loaded</p></div><div className="flex gap-2"><button type="button" aria-label="Previous week" onClick={()=>setOffset(n=>n-1)} className="min-h-11 min-w-11 rounded-lg border border-line">←</button><button type="button" onClick={()=>setOffset(0)} className="min-h-11 rounded-lg border border-line px-3 text-sm">This week</button><button type="button" aria-label="Next week" onClick={()=>setOffset(n=>n+1)} className="min-h-11 min-w-11 rounded-lg border border-line">→</button></div></div>
 <p className="mt-4 text-sm font-medium">{days[0].toLocaleDateString(locale,{month:"short",day:"numeric",timeZone:"UTC"})} – {days[6].toLocaleDateString(locale,{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"})}</p>
 <ol className="mt-4 grid gap-2 sm:grid-cols-7">{days.map(day=>{const date=day.toISOString().slice(0,10);const dayPosts=posts.filter(p=>p.status!=="cancelled"&&key(new Date(p.scheduled_for??p.created_at))===date).sort((a,b)=>(a.scheduled_for??a.created_at).localeCompare(b.scheduled_for??b.created_at));return <li key={date} className={"min-w-0 rounded-xl border p-2 "+(date===today?"border-accent bg-accent-soft":"border-line")}><p className="text-xs font-medium">{day.toLocaleDateString(locale,{weekday:"short",day:"numeric",timeZone:"UTC"})}</p>{dayPosts.length?<ul className="mt-2 grid gap-2">{dayPosts.map(p=><li key={p.id}><a href={`#post-${p.id}`} className="block min-h-11 rounded-lg bg-raised p-2 text-xs hover:text-accent"><span className="font-medium">{new Date(p.scheduled_for??p.created_at).toLocaleTimeString(locale,{timeZone,hour:"numeric",minute:"2-digit"})}</span><span className="mt-1 block">{t.publish.status[p.status]}</span><span className="mt-1 line-clamp-2 break-words text-muted">{p.caption}</span></a></li>)}</ul>:<p className="mt-2 text-xs text-muted">—</p>}</li>;})}</ol><p className="mt-4 text-xs text-muted">Choose an ad from a product or campaign to fill an open day. Existing posts and your queue settings appear below.</p></section>;
}
