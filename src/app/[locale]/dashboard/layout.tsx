import { AccountMenu } from "./account-menu";
import { Spotlight } from "@/app/_landing/spotlight";
import { isLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { notFound } from "next/navigation";
import { AppNav } from "./app-nav";
import { AdminLink } from "./admin/admin-link";
import { Suspense } from "react";
import { CreditsLink } from "./credits-link";
import { BoostCard, BoostTeaser, CreateNew, MobileMenu, SidebarBody } from "./app-shell";
import { createClient } from "@/lib/supabase/server";
import { ActivityAside, ActivityProvider, ActivityToggle, MenuFold, MenuFrame } from "./activity-panel";
import { ActivityFeed } from "./activity-feed";

export default async function DashboardLayout({
  children,
  params,
}: LayoutProps<"/[locale]/dashboard">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getMessages(locale);
  const nav = (
    <AppNav
      items={[
        { href: "/dashboard", label: t.app.products },
        { href: "/dashboard/ads", label: t.library.title },
        { href: "/dashboard/campaigns", label: t.app.campaigns },
        { href: "/dashboard/publishing", label: t.publish.title },
        { href: "/dashboard/brand", label: t.app.brandKit },
      ]}
    />
  );
  const admin = <Suspense fallback={null}><AdminLink /></Suspense>;
  const account = (
    <Suspense fallback={<AccountMenu admin={admin} />}>
      <Account admin={admin} />
    </Suspense>
  );
  // "landing" gives the app the site's cards and hover effects. Grid items
  // may shrink below their content (a long, truncated product name), so a
  // phone never scrolls sideways.
  return (
    <ActivityProvider>
    <div className="landing flex flex-1 bg-bg text-fg [&_.grid>*]:min-w-0">
      <a href="#app-content" className="skip-link">{t.nav.skip}</a>
      {/* Desktop: the sections live in a sidebar on the start side. */}
      <MenuFrame>
        <SidebarBody nav={nav} account={account} fold={<MenuFold />} />
      </MenuFrame>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
          <div className="flex h-16 items-center gap-2 px-2 sm:px-6">
            {/* Phones and tablets: the sidebar opens as a drawer. */}
            <MobileMenu>
              <SidebarBody nav={nav} account={account} extra={<BoostCard />} />
            </MobileMenu>
            <div className="ms-auto flex min-w-0 items-center gap-1 sm:gap-2">
              <CreateNew />
              <BoostTeaser className="hidden sm:block" />
              <Suspense fallback={null}>
                <CreditsLink locale={locale} className="inline-flex" />
              </Suspense>
              <ActivityToggle />
            </div>
          </div>
        </header>
        {/* Pages use more of the screen than their own column asks for; narrow
            forms (max-w-xl) keep their width. */}
        <div id="app-content" tabIndex={-1} className="flex flex-1 flex-col focus:outline-none [&>main:not(.max-w-xl)]:max-w-[90rem] sm:[&>main]:px-6 xl:[&>main]:px-10">
          {children}
        </div>
      </div>
      {/* Wide screens: a third column with what's happening; smaller screens
          open it from the top bar. */}
      <ActivityAside>
        <Suspense fallback={<p className="text-sm text-muted">{t.app.loading}</p>}>
          <ActivityFeed locale={locale} />
        </Suspense>
      </ActivityAside>
      <Spotlight />
    </div>
    </ActivityProvider>
  );
}

// The signed-in person's email, shown on the account card.
async function Account({ admin }: { admin: React.ReactNode }) {
  const { data } = await (await createClient()).auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email : "";
  return <AccountMenu admin={admin} email={email} />;
}
