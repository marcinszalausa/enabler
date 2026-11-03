import {notFound} from "next/navigation";
import {isLocale} from "@/i18n/config";
import {pageMetadata} from "@/lib/seo";
import {LegalPage} from "@/app/_landing/legal";
import {PolicyContent} from "@/app/_landing/policy-content";
import data from "@/lib/legal-documents.json";
export async function generateMetadata({params}:PageProps<"/[locale]/terms">){
 const {locale}=await params;if(!isLocale(locale))return {};
 return {...pageMetadata(locale,"/terms",data.documents.terms.title+" · Gooidy",data.documents.terms.summary),robots:{index:false,follow:true}};
}
export default async function Page({params}:PageProps<"/[locale]/terms">){
 const {locale}=await params;if(!isLocale(locale))notFound();
 return <LegalPage locale={locale} title={data.documents.terms.title} updated={data.updated}><PolicyContent id="terms" locale={locale}/></LegalPage>;
}
