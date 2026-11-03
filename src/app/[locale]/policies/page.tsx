import Link from "next/link";
import {notFound} from "next/navigation";
import {isLocale,localePath} from "@/i18n/config";
import {pageMetadata} from "@/lib/seo";
import {LegalPage} from "@/app/_landing/legal";
import {POLICY_IDS,policyPath} from "@/lib/legal-policy";
import data from "@/lib/legal-documents.json";
export async function generateMetadata({params}:PageProps<"/[locale]/policies">){
 const {locale}=await params;if(!isLocale(locale))return {};
 return {...pageMetadata(locale,"/policies","Policies and Privacy · Gooidy","Service policies and privacy request options."),robots:{index:false,follow:true}};
}
export default async function Page({params}:PageProps<"/[locale]/policies">){
 const {locale}=await params;if(!isLocale(locale))notFound();
 return <LegalPage locale={locale} title="Policies and Privacy" updated={data.updated}>
  <p>Read how Gooidy handles your content, account and information. Privacy requests are handled manually during pre-launch.</p>
  <ul data-policy-directory className="mt-7 !list-none space-y-3 !pl-0">
   {POLICY_IDS.map(id=><li key={id}><Link href={localePath(locale,policyPath(id))} className="block rounded-2xl border border-line bg-surface p-5 !no-underline hover:bg-raised">
    <span className="block font-semibold">{data.documents[id].title}</span><span className="mt-2 block text-sm text-muted">{data.documents[id].summary}</span>
   </Link></li>)}
  </ul>
  <p>Need help? <a href="mailto:hello@gooidy.com">hello@gooidy.com</a></p>
 </LegalPage>;
}
