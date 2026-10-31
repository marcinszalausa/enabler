import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { LoginForm } from "./login-form";
import { AppBar } from "@/app/_landing/chrome";

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
}: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <div className="landing flex flex-1 flex-col bg-bg text-fg">
      <AppBar />
      <main className="hero-bg flex flex-1 items-center justify-center px-4 py-16">
        <div data-account-form className="w-full max-w-lg rounded-2xl border border-line bg-raised p-8 shadow-[0_24px_60px_-30px_rgb(var(--t-shadow)/0.35)]">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
