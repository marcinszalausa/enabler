import Link from "next/link";
import {notFound} from "next/navigation";
import {isLocale,localePath} from "@/i18n/config";
import {informationMetadata} from "@/lib/public-information-seo";
import {InformationPage,InformationHero,WorkflowIllustration} from "@/app/_landing/information-page";
import {Suspense} from "react";
import {INDUSTRIES,industry} from "@/lib/discovery-content";
import {ProofPreview} from "@/app/_landing/proof-preview";
export function generateStaticParams(){return INDUSTRIES.map(item=>({industry:item.slug}));}
export async function generateMetadata({params}:PageProps<"/[locale]/industries/[industry]">){const p=industry((await params).industry);return p?informationMetadata("/industries/"+p.slug,p.name+" ads · Gooidy",p.description):{};}
export default async function Page({params}:PageProps<"/[locale]/industries/[industry]">){const {locale,industry:slug}=await params;if(!isLocale(locale))notFound();const p=industry(slug);if(!p)notFound();return <InformationPage><div lang="en"><InformationHero eyebrow={p.name} title={p.title} description={p.description} locale={locale}/><section className="mx-auto max-w-5xl px-4 py-12"><h2 className="text-2xl font-semibold">One product. One clear benefit.</h2><WorkflowIllustration steps={["Add your product page",p.benefit,"Review, download or schedule"]}/><div className="mt-8 grid items-start gap-6 md:grid-cols-2"><Suspense fallback={<div className="edge p-6">Loading example…</div>}><ProofPreview item={p}/></Suspense><section className="edge p-6"><h2 className="text-xl font-semibold">What to check before posting</h2><ul className="mt-4 space-y-4">{p.checks.map(check=><li key={check} className="flex gap-3 text-sm"><span aria-hidden className="text-accent">✓</span>{check}</li>)}</ul><Link href={localePath(locale,"/help/quality-review")} className="mt-5 inline-flex min-h-11 items-center text-accent">Use the review checklist →</Link></section></div></section></div></InformationPage>;}
