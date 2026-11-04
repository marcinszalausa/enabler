import Link from "next/link";
import {notFound} from "next/navigation";
import {isLocale,localePath} from "@/i18n/config";
import {informationMetadata} from "@/lib/public-information-seo";
import {InformationPage,InformationHero} from "@/app/_landing/information-page";
import {INDUSTRIES} from "@/lib/discovery-content";
export const metadata=informationMetadata("/industries","Ads for the products you sell · Gooidy","Start with a real product, a clear benefit and a believable everyday scene.");
export default async function Page({params}:PageProps<"/[locale]/industries">){const {locale}=await params;if(!isLocale(locale))notFound();return <InformationPage><div lang="en"><InformationHero eyebrow="Industries" title="Ads for the products you sell" description="Start with a real product, a clear benefit and a believable everyday scene." locale={locale}/><section className="mx-auto grid max-w-5xl gap-5 px-4 py-12 sm:grid-cols-2">{INDUSTRIES.map(item=><Link key={item.slug} href={localePath(locale,"/industries/"+item.slug)} prefetch={false} className="edge p-6"><h2 className="text-xl font-semibold">{item.title}</h2><p className="mt-3 text-sm text-muted">{item.description}</p><span className="mt-4 inline-flex min-h-11 items-center text-sm text-accent">Read more →</span></Link>)}</section></div></InformationPage>;}
