import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { LoginForm } from "./login-form";
import { AppBar } from "@/app/_landing/chrome";
import Link from "next/link";
import { SetupSteps } from "@/app/_landing/setup-steps";
import { safeNextPath, setupContext } from "@/lib/onboarding";
import { GENERATION_COST } from "@/lib/image-pricing";
import { DEFAULT_VIDEO_OPTIONS, VIDEOS_PER_GENERATION, videoRunCost } from "@/lib/video-options";
import { fmt } from "@/i18n/format";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: (await getMessages(locale)).meta.signInTitle,
    // Sign-in is for customers, not for search results.
    robots: { index: false },
  };
}

export default async function LoginPage({
  params,
  searchParams,
}: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getMessages(locale);
  return (
    <div className="landing flex flex-1 flex-col bg-bg text-fg">
      <AppBar />
      <main className="hero-bg flex flex-1 items-center justify-center px-4 py-16">
        <Suspense fallback={<p className="text-sm text-muted">{t.app.loading}</p>}>
          <AccountCard locale={locale} searchParams={searchParams}/>
        </Suspense>
      </main>
    </div>
  );
}

async function AccountCard({locale,searchParams}:{locale:Locale;searchParams:PageProps<"/[locale]/login">["searchParams"]}){
  const query=await searchParams,t=await getMessages(locale);
  const setup=setupContext(safeNextPath(typeof query.next==="string"?query.next:null));
  return <div data-account-form className="w-full max-w-lg rounded-2xl border border-line bg-raised p-6 shadow-[0_24px_60px_-30px_rgb(var(--t-shadow)/0.35)] sm:p-8">
    {setup&&<SetupSteps t={t} current={3}/>}
    <h1 className="text-2xl font-semibold">{setup?t.onboard.accountTitle:t.login.title}</h1>
    <p className="mt-2 text-sm text-muted">{setup?t.home.finalSub:t.login.sub}</p>
    {setup&&<div className="mt-5 rounded-xl border border-line bg-surface p-4 text-sm">
      <p className="break-all font-medium">{new URL(setup.url).hostname}</p>
      <p className="mt-1 break-all text-xs text-muted">{setup.url}</p>
      <p className="mt-3 font-medium">{fmt(setup.kind==="image"?t.app.imageAds:t.app.videoAds,{count:setup.kind==="image"?10:VIDEOS_PER_GENERATION})} · {fmt(t.app.credits,{count:setup.kind==="image"?GENERATION_COST:videoRunCost(DEFAULT_VIDEO_OPTIONS.length)})}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted">{t.onboard.prepareNote}</p>
    </div>}
    <LoginForm/>
    <div className="mt-5 flex gap-4 text-xs text-muted"><Link href={localePath(locale,"/privacy")} className="underline">{t.footer.privacy}</Link><Link href={localePath(locale,"/terms")} className="underline">{t.footer.terms}</Link></div>
  </div>;
}
