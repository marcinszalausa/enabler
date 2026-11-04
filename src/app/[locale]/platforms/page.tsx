import Link from "next/link";
import {notFound} from "next/navigation";
import {isLocale,localePath} from "@/i18n/config";
import {informationMetadata} from "@/lib/public-information-seo";
import {InformationPage,InformationHero} from "@/app/_landing/information-page";
import {PLATFORM_GUIDES} from "@/lib/discovery-content";
export const metadata=informationMetadata("/platforms","Show up where your customers spend time · Gooidy","Create once, review carefully and choose the right destination for your post.");
export default async function Page({params}:PageProps<"/[locale]/platforms">){const {locale}=await params;if(!isLocale(locale))notFound();return <InformationPage><div lang="en"><InformationHero eyebrow="Platforms" title="Show up where your customers spend time" description="Create once, review carefully and choose the right destination for your post." locale={locale}/><section className="mx-auto grid max-w-5xl gap-5 px-4 py-12 sm:grid-cols-2">{PLATFORM_GUIDES.map(item=><Link key={item.slug} href={localePath(locale,"/platforms/"+item.slug)} prefetch={false} className="edge p-6"><h2 className="text-xl font-semibold">{item.title}</h2><p className="mt-3 text-sm text-muted">{item.formats}</p><span className="mt-4 inline-flex min-h-11 items-center text-sm text-accent">Read more →</span></Link>)}</section></div></InformationPage>;}
