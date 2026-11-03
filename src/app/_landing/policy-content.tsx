import Link from "next/link";
import documents from "@/lib/legal-documents.json";
import {POLICY_IDS,PRIVACY_REQUESTS,policyPath,privacyRequestHref,type PolicyId} from "@/lib/legal-policy";
import {localePath,type Locale} from "@/i18n/config";
type Section={title:string;paragraphs?:string[];items?:string[]};
export function PolicyContent({id,locale}:{id:PolicyId;locale:Locale}){
 const document=documents.documents[id];
 return <div data-policy-document={id}>
  <p className="text-lg text-muted">{document.summary}</p>
  <nav aria-label="On this page" className="my-7 rounded-2xl border border-line bg-surface p-5">
   <p className="font-medium">On this page</p>
   <ul className="mt-3 space-y-2">{document.sections.map((section,index)=><li key={section.title}><a href={"#section-"+(index+1)} className="text-accent underline-offset-4 hover:underline">{section.title}</a></li>)}</ul>
  </nav>
  {(document.sections as Section[]).map((section,index)=><section key={section.title} aria-labelledby={"section-"+(index+1)}>
   <h2 id={"section-"+(index+1)} className="scroll-mt-28">{section.title}</h2>
   {section.paragraphs?.map(p=><p key={p}>{p}</p>)}
   {section.items&&<ul>{section.items.map(item=><li key={item}>{item}</li>)}</ul>}
  </section>)}
  {id==="privacy-requests"&&<div data-privacy-request-options className="my-8 grid gap-3 sm:grid-cols-2">
   {Object.entries(PRIVACY_REQUESTS).map(([kind,label])=><a key={kind} href={privacyRequestHref(kind as keyof typeof PRIVACY_REQUESTS)} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line bg-surface px-4 py-3 text-center text-sm font-medium text-accent hover:bg-raised">{label}</a>)}
  </div>}
  <nav aria-label="Related policies" className="mt-10 border-t border-line pt-6">
   <p className="font-medium">Related policies</p>
   <ul>{POLICY_IDS.filter(other=>other!==id).map(other=><li key={other}><Link href={localePath(locale,policyPath(other))}>{documents.documents[other].title}</Link></li>)}</ul>
   <p><a href="mailto:hello@gooidy.com">hello@gooidy.com</a></p>
  </nav>
 </div>;
}
