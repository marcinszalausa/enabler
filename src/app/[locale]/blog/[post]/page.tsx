import Link from "next/link";
import {notFound} from "next/navigation";
import {isLocale,localePath} from "@/i18n/config";
import {informationMetadata} from "@/lib/public-information-seo";
import {InformationPage,InformationHero} from "@/app/_landing/information-page";
import {BLOG_POSTS,blogPost} from "@/lib/discovery-content";
export function generateStaticParams(){return BLOG_POSTS.map(item=>({post:item.slug}));}
export async function generateMetadata({params}:PageProps<"/[locale]/blog/[post]">){const p=blogPost((await params).post);return p?informationMetadata("/blog/"+p.slug,p.title+" · Gooidy",p.summary):{};}
export default async function Page({params}:PageProps<"/[locale]/blog/[post]">){const {locale,post}=await params;if(!isLocale(locale))notFound();const p=blogPost(post);if(!p)notFound();return <InformationPage><article lang="en"><InformationHero eyebrow={p.category} title={p.title} description={p.summary} locale={locale}/><div className="mx-auto max-w-3xl px-4 py-12"><p className="text-sm text-muted">{p.readMinutes} minute read · Gooidy guides</p><div className="mt-7 space-y-8">{p.sections.map(section=><section key={section.title}><h2 className="text-xl font-semibold">{section.title}</h2><p className="mt-3 leading-relaxed text-muted">{section.body}</p></section>)}</div><Link href={localePath(locale,p.next)} className="mt-8 inline-flex min-h-11 items-center rounded-xl border border-line-strong px-5 text-accent">{"Take the next step"} →</Link><p className="mt-8"><Link className="text-accent underline" href={localePath(locale,"/blog")}>All articles</Link></p></div></article></InformationPage>;}
