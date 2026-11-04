import Link from "next/link";
import {notFound} from "next/navigation";
import {isLocale,localePath} from "@/i18n/config";
import {informationMetadata} from "@/lib/public-information-seo";
import {InformationPage,InformationHero} from "@/app/_landing/information-page";
import {BLOG_POSTS} from "@/lib/discovery-content";
export const metadata=informationMetadata("/blog","Practical ideas for your next campaign · Gooidy","Simple ways to choose a message, review an ad and learn from your next post.");
export default async function Page({params}:PageProps<"/[locale]/blog">){const {locale}=await params;if(!isLocale(locale))notFound();return <InformationPage><div lang="en"><InformationHero eyebrow="Blog" title="Practical ideas for your next campaign" description="Simple ways to choose a message, review an ad and learn from your next post." locale={locale}/><section className="mx-auto grid max-w-5xl gap-5 px-4 py-12 sm:grid-cols-2">{BLOG_POSTS.map(item=><Link key={item.slug} href={localePath(locale,"/blog/"+item.slug)} prefetch={false} className="edge p-6"><h2 className="text-xl font-semibold">{item.title}</h2><p className="mt-3 text-sm text-muted">{item.summary}</p><span className="mt-4 inline-flex min-h-11 items-center text-sm text-accent">Read more →</span></Link>)}</section></div></InformationPage>;}
