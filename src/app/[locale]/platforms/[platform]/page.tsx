import Link from "next/link";
import {notFound} from "next/navigation";
import {isLocale,localePath} from "@/i18n/config";
import {informationMetadata} from "@/lib/public-information-seo";
import {InformationPage,InformationHero,WorkflowIllustration} from "@/app/_landing/information-page";
import {PLATFORM_GUIDES,platformGuide} from "@/lib/discovery-content";
export function generateStaticParams(){return PLATFORM_GUIDES.map(item=>({platform:item.slug}));}
export async function generateMetadata({params}:PageProps<"/[locale]/platforms/[platform]">){const p=platformGuide((await params).platform);return p?informationMetadata("/platforms/"+p.slug,p.name+" product posts · Gooidy",p.title):{};}
export default async function Page({params}:PageProps<"/[locale]/platforms/[platform]">){const {locale,platform}=await params;if(!isLocale(locale))notFound();const p=platformGuide(platform);if(!p)notFound();return <InformationPage><div lang="en"><InformationHero eyebrow={p.name} title={p.title} description={p.formats} locale={locale}/><section className="mx-auto max-w-5xl px-4 py-12"><h2 className="text-2xl font-semibold">From a product to a post</h2><WorkflowIllustration steps={p.steps}/><p className="mt-8 rounded-xl border border-line bg-surface p-5 text-sm leading-relaxed">{p.note}</p><p className="mt-5 text-sm text-muted">Generation credits cover creative production. Publishing is subject to connected-account permissions and limits. Organic posting does not purchase paid advertising.</p><Link href={localePath(locale,"/help/connect-accounts")} className="mt-5 inline-flex min-h-11 items-center text-accent">See the account connection guide →</Link></section></div></InformationPage>;}
