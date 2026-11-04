"use client";
import {useState} from "react";
import Link from "next/link";
import {HELP_ARTICLES,searchHelp} from "@/lib/discovery-content";
import {localePath,type Locale} from "@/i18n/config";
export function HelpSearch({locale}:{locale:Locale}){
 const [query,setQuery]=useState("");const [category,setCategory]=useState("All");const results=searchHelp(query,category);
 return <section className="mx-auto max-w-5xl px-4 py-12"><label htmlFor="help-search" className="font-medium">What do you need help with?</label><input id="help-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Try credits, captions or publishing" className="mt-3 block min-h-12 w-full rounded-xl border border-line-strong bg-bg px-4"/><label className="mt-5 block text-sm">Topic<select value={category} onChange={e=>setCategory(e.target.value)} className="ml-3 min-h-11 rounded-lg border border-line bg-bg px-3">{["All",...new Set(HELP_ARTICLES.map(a=>a.category))].map(c=><option key={c}>{c}</option>)}</select></label><p role="status" className="mt-5 text-sm text-muted">{results.length} {results.length===1?"guide":"guides"} found</p><div className="mt-4 grid gap-4 sm:grid-cols-2">{results.map(a=><Link key={a.slug} href={localePath(locale,"/help/"+a.slug)} prefetch={false} className="edge p-5"><span className="text-xs text-accent">{a.category}</span><h2 className="mt-2 font-semibold">{a.title}</h2><p className="mt-2 text-sm text-muted">{a.summary}</p></Link>)}</div>{!results.length&&<p className="mt-6">Try a shorter search or choose All topics. You can also <a className="text-accent underline" href="mailto:hello@gooidy.com">contact support</a>.</p>}</section>;
}
