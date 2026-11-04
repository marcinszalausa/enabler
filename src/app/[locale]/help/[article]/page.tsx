import Link from "next/link";
import {notFound} from "next/navigation";
import {isLocale,localePath} from "@/i18n/config";
import {informationMetadata} from "@/lib/public-information-seo";
import {InformationPage,InformationHero} from "@/app/_landing/information-page";
import {HELP_ARTICLES,helpArticle} from "@/lib/discovery-content";
export function generateStaticParams(){return HELP_ARTICLES.map(item=>({article:item.slug}));}
export async function generateMetadata({params}:PageProps<"/[locale]/help/[article]">){const p=helpArticle((await params).article);return p?informationMetadata("/help/"+p.slug,p.title+" · Gooidy",p.summary):{};}
export default async function Page({params}:PageProps<"/[locale]/help/[article]">){const {locale,article}=await params;if(!isLocale(locale))notFound();const p=helpArticle(article);if(!p)notFound();return <InformationPage><article lang="en"><InformationHero eyebrow={p.category} title={p.title} description={p.summary} locale={locale}/><div className="mx-auto max-w-3xl px-4 py-12"><ol className="mt-7 list-decimal space-y-5 pl-6">{p.steps.map(step=><li key={step} className="pl-2 leading-relaxed">{step}</li>)}</ol><Link href={localePath(locale,p.next)} className="mt-8 inline-flex min-h-11 items-center rounded-xl border border-line-strong px-5 text-accent">{p.nextLabel} →</Link><p className="mt-8"><Link className="text-accent underline" href={localePath(locale,"/help")}>All guides</Link></p></div></article></InformationPage>;}
