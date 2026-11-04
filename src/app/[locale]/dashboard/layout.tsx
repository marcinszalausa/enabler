import { AccountMenu } from "./account-menu";
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
      <a href="#app-content" className="skip-link">{t.nav.skip}</a>
      <AppBar homeHref="/dashboard"
        tabs={
          <AppNav
            items={[
              { href: "/dashboard", label: t.app.products },
              { href: "/dashboard/ads", label: t.library.title },
              { href: "/dashboard/campaigns", label: "Campaigns" },
              { href: "/dashboard/publishing", label: t.publish.title },
              { href: "/dashboard/brand", label: t.app.brandKit },
            ]}
          />
        }
      >
        <AccountMenu />
      </AppBar>
      <div id="app-content" tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">{children}</div>
      <Spotlight />
    </div>
  );
}

