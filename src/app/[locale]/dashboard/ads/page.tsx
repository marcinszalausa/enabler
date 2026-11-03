import {Suspense} from "react";
import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {getCurrentUser} from "@/lib/auth";
import {createClient} from "@/lib/supabase/server";
import {getMessages,type Messages} from "@/i18n/messages";
import {isLocale} from "@/i18n/config";
import {libraryFilter} from "@/lib/ad-library";
import {readAdLibrary} from "@/lib/ad-library-query";
import {LibraryView} from "./library-view";
export async function generateMetadata({params}:PageProps<"/[locale]/dashboard/ads">):Promise<Metadata>{
 const {locale}=await params;if(!isLocale(locale))return {};
 return {title:(await getMessages(locale)).library.title+" · Gooidy"};
}
export default async function AdsPage({params,searchParams}:PageProps<"/[locale]/dashboard/ads">){
 const {locale}=await params;if(!isLocale(locale))notFound();const t=await getMessages(locale);
 return <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
  <h1 className="text-3xl font-semibold tracking-tight">{t.library.title}</h1><p className="mt-2 max-w-2xl text-sm text-muted">{t.library.intro}</p>
  <Suspense fallback={<p role="status" className="mt-6 text-sm text-muted">{t.app.loading}</p>}><Ads t={t} searchParams={searchParams}/></Suspense>
 </main>;
}
async function Ads({t,searchParams}:{t:Messages;searchParams:PageProps<"/[locale]/dashboard/ads">["searchParams"]}){
 const user=await getCurrentUser(),client=await createClient();
 const filter=libraryFilter(await searchParams);
 const result=await readAdLibrary(client,user.id,filter);
 return <LibraryView t={t} {...result} filter={filter}/>;
}
