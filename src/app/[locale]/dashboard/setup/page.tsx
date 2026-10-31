import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isLocale, localePath } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { adKind, productLink } from "@/lib/onboarding";
import { GENERATION_COST } from "@/lib/image-pricing";
import { DEFAULT_VIDEO_OPTIONS, videoRunCost, VIDEOS_PER_GENERATION } from "@/lib/video-options";
import { fmt } from "@/i18n/format";
import { ProductUrlForm } from "../product-url-form";
export const maxDuration = 120;
export default function SetupPage({params,searchParams}:PageProps<"/[locale]/dashboard/setup">){
  return <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10"><Suspense><Setup params={params} searchParams={searchParams}/></Suspense></main>;
}
async function Setup({params,searchParams}:PageProps<"/[locale]/dashboard/setup">){
  const {locale}=await params;if(!isLocale(locale))notFound();
  await getCurrentUser();
  const t=await getMessages(locale),query=await searchParams;
  const url=productLink(query.url),kind=adKind(query.kind);
  if(!url)redirect(localePath(locale,"/start"));
  return <section className="rounded-2xl border border-line bg-raised p-6 sm:p-8">
    <p className="text-sm font-medium text-ok">✓ {t.footer.account}</p>
    <h1 className="mt-3 text-2xl font-semibold">{t.onboard.prepareTitle}</h1>
    <p className="mt-3 text-sm leading-relaxed text-muted">{t.personal.setupNote}</p>
    <div className="my-6 rounded-xl bg-surface p-4 text-sm">
      <p className="font-medium">{fmt(kind==="image"?t.app.imageAds:t.app.videoAds,{count:kind==="image"?10:VIDEOS_PER_GENERATION})}</p>
      <p className="mt-1 text-muted">{fmt(t.app.credits,{count:kind==="image"?GENERATION_COST:videoRunCost(DEFAULT_VIDEO_OPTIONS.length)})}</p>
    </div>
    <ProductUrlForm defaultUrl={url} onboardingKind={kind}/>
    <Link href={localePath(locale,"/start")+"?"+new URLSearchParams({url,kind})} className="mt-5 inline-flex min-h-11 items-center text-sm text-accent hover:underline">{t.onboard.back}</Link>
  </section>;
}
