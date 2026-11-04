import Link from "next/link";
import {notFound} from "next/navigation";
import {isLocale,localePath} from "@/i18n/config";
import {PUBLIC_FEATURES} from "@/lib/public-information";
import {informationMetadata} from "@/lib/public-information-seo";
import {InformationPage,InformationHero} from "@/app/_landing/information-page";
export const metadata=informationMetadata("/features","What you can do · Gooidy","Create product ads, remember your brand, plan campaigns and publish from one place.");
export default async function Features({params}:PageProps<"/[locale]/features">){const {locale}=await params;if(!isLocale(locale))notFound();return <InformationPage><div lang="en"><InformationHero eyebrow="Made for your next campaign" title="From a product link to something worth sharing" description="Create the ads, keep them on brand, and organize what happens next in one place." locale={locale}/><section className="mx-auto grid max-w-5xl gap-5 px-4 py-12 sm:grid-cols-2">{PUBLIC_FEATURES.map(feature=><Link key={feature.slug} href={localePath(locale,"/features/"+feature.slug)} className="edge group p-6"><p className="text-xs font-medium text-accent">{feature.category}</p><h2 className="mt-2 text-xl font-semibold">{feature.label}<span aria-hidden className="float-end text-accent">↗</span></h2><p className="mt-3 text-sm leading-relaxed text-muted">{feature.description}</p></Link>)}</section></div></InformationPage>;}
