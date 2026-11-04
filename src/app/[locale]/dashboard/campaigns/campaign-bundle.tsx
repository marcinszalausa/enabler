"use client";
import Link from "next/link";
import type { CampaignPlan } from "@/lib/customer-workflow";
export function CampaignBundle({campaign,copy}:{campaign:CampaignPlan;copy:{headline:string|null;primary_text:string|null;cta:string|null;kind:string;aspect:string}[]}) {
  function downloadCopy() {
    const text=[campaign.name,"",...copy.flatMap((ad,i)=>[`${i+1}. ${ad.kind} · ${ad.aspect}`,ad.headline,ad.primary_text,ad.cta,""])].filter(line=>line!==null).join("\n");
    const url=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"}));
    const a=document.createElement("a");a.href=url;a.download="gooidy-campaign-copy.txt";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <section className="edge mt-6 grid gap-4 p-5 sm:p-6" data-campaign-bundle><div><p className="text-xs font-medium text-accent">Your campaign</p><h2 className="mt-1 text-xl font-semibold">{campaign.name}</h2><p className="mt-2 text-sm text-muted">{campaign.message}</p>{campaign.offer&&<p className="mt-2 text-sm">{campaign.offer}</p>}</div><div className="flex flex-wrap gap-2 text-sm"><span className="rounded-lg bg-surface px-3 py-2">{copy.filter(c=>c.kind==="image").length} images</span><span className="rounded-lg bg-surface px-3 py-2">{copy.filter(c=>c.kind==="video").length} videos</span><span className="rounded-lg bg-surface px-3 py-2">Captions included</span></div><ol className="grid gap-3 text-sm sm:grid-cols-3"><li>① Create matching images and videos</li><li>② Review your favorite ads below</li><li>③ Post or schedule from each batch</li></ol><div className="flex flex-wrap gap-3">{copy.length>0&&<button type="button" onClick={downloadCopy} className="min-h-11 rounded-lg border border-line-strong px-3 text-sm">Download campaign copy</button>}<Link href="/dashboard/publishing" className="inline-flex min-h-11 items-center text-sm text-accent">Open posting calendar →</Link><Link href="/dashboard/campaigns" className="inline-flex min-h-11 items-center text-sm text-muted">All campaigns →</Link></div></section>;
}
