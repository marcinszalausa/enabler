import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {isLocale} from "@/i18n/config";
import {getMessages} from "@/i18n/messages";
import {pageMetadata} from "@/lib/seo";
import {StudioHome} from "@/app/_landing/studio-home";

export async function generateMetadata({params}:PageProps<"/[locale]">):Promise<Metadata>{
 const {locale}=await params;
 if(!isLocale(locale))return {};
 const t=await getMessages(locale);
 return pageMetadata(locale,"/",t.meta.title,t.meta.description);
}
export default async function Home({params}:PageProps<"/[locale]">){
 const {locale}=await params;
 if(!isLocale(locale))notFound();
 const t=await getMessages(locale);
 return <StudioHome locale={locale} t={t}/>;
}
