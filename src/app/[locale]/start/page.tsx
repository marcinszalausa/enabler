import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AppBar } from "@/app/_landing/chrome";
import { isLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { StartFlow } from "./start-flow";
export async function generateMetadata({params}: PageProps<"/[locale]/start">) {
  const {locale}=await params;
  if(!isLocale(locale))return {};
  const t=await getMessages(locale);
  return {title:t.onboard.title+" · Gooidy",robots:{index:false,follow:true}};
}
export default async function StartPage({params}: PageProps<"/[locale]/start">){
  const {locale}=await params;
  if(!isLocale(locale))notFound();
  const t=await getMessages(locale);
  return <div className="landing flex min-h-screen flex-col bg-bg text-fg"><AppBar/>
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-16">
      <Suspense fallback={<p>{t.app.loading}</p>}><StartFlow/></Suspense>
    </main>
  </div>;
}
