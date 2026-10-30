import { AppBar } from "@/app/_landing/chrome";
import { Spotlight } from "@/app/_landing/spotlight";
import { isLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { notFound } from "next/navigation";
import { AppNav } from "./app-nav";

export default async function DashboardLayout({
  children,
  params,
}: LayoutProps<"/[locale]/dashboard">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getMessages(locale);
  // "landing" gives the app the site's cards and hover effects.
  return (
    <div className="landing flex flex-1 flex-col bg-bg text-fg">
      <AppBar
        tabs={
          <AppNav
            items={[
              { href: "/dashboard", label: t.app.products },
              { href: "/dashboard/brand", label: t.app.brandKit },
              { href: "/dashboard/publishing", label: t.publish.title },
            ]}
          />
        }
      >
        <form action="/auth/signout" method="post">
          <button
            title={t.app.signOut}
            className="flex h-9 items-center whitespace-nowrap rounded-lg px-2 text-muted transition hover:bg-surface hover:text-fg sm:px-3"
          >
            {/* Phones show an icon, so the bar fits on one line. */}
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 sm:hidden rtl:-scale-x-100"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            <span className="sr-only sm:not-sr-only">{t.app.signOut}</span>
          </button>
        </form>
      </AppBar>
      {children}
      <Spotlight />
    </div>
  );
}
