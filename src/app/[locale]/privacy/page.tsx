import {notFound} from "next/navigation";
import {isLocale} from "@/i18n/config";
import {pageMetadata} from "@/lib/seo";
import {LegalPage} from "@/app/_landing/legal";
import {PolicyContent} from "@/app/_landing/policy-content";
import data from "@/lib/legal-documents.json";
export async function generateMetadata({params}:PageProps<"/[locale]/privacy">){
 const {locale}=await params;if(!isLocale(locale))return {};
 return {...pageMetadata(locale,"/privacy",data.documents.privacy.title+" · Gooidy",data.documents.privacy.summary),robots:{index:false,follow:true}};
}
export default async function Page({params}:PageProps<"/[locale]/privacy">){
 const {locale}=await params;if(!isLocale(locale))notFound();
 return <LegalPage locale={locale} title={data.documents.privacy.title} updated={data.updated}><PolicyContent id="privacy" locale={locale}/></LegalPage>;
}
