import {notFound,redirect} from "next/navigation";
import {isLocale,localePath} from "@/i18n/config";
import {pageMetadata} from "@/lib/seo";
import {LegalPage} from "@/app/_landing/legal";
import {PolicyContent} from "@/app/_landing/policy-content";
import {POLICY_IDS,isPolicyId,policyPath} from "@/lib/legal-policy";
import data from "@/lib/legal-documents.json";
export function generateStaticParams(){return POLICY_IDS.filter(id=>id!=="terms"&&id!=="privacy").map(document=>({document}));}
export async function generateMetadata({params}:PageProps<"/[locale]/policies/[document]">){
 const {locale,document}=await params;if(!isLocale(locale)||!isPolicyId(document))return {};
 return {...pageMetadata(locale,policyPath(document),data.documents[document].title+" · Gooidy",data.documents[document].summary),robots:{index:false,follow:true}};
}
export default async function Page({params}:PageProps<"/[locale]/policies/[document]">){
 const {locale,document}=await params;if(!isLocale(locale)||!isPolicyId(document))notFound();
 if(document==="privacy"||document==="terms")redirect(localePath(locale,policyPath(document)));
 return <LegalPage locale={locale} title={data.documents[document].title} updated={data.updated}><PolicyContent id={document} locale={locale}/></LegalPage>;
}
