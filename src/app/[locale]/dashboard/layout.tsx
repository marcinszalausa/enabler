import { AccountMenu } from "./account-menu";
import { isLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { notFound } from "next/navigation";
import { AppNav } from "./app-nav";
import { AdminLink } from "./admin/admin-link";
import { Suspense } from "react";
import { CreditsLink } from "./credits-link";
import { createClient } from "@/lib/supabase/server";
import { DashboardFrame } from "./dashboard-frame";
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
        { href: "/dashboard/stores", label: "Stores" },
      ]}
    />
  );
  const admin = <Suspense fallback={null}><AdminLink /></Suspense>;
  const account = (
    <Suspense fallback={<AccountMenu admin={admin} />}>
      <Account admin={admin} />
    </Suspense>
  );
  return (
    <DashboardFrame nav={nav} account={account}
      credits={<Suspense fallback={null}><CreditsLink locale={locale} className="inline-flex"/></Suspense>}
      activity={<Suspense fallback={<p className="text-sm text-muted">{t.app.loading}</p>}><ActivityFeed locale={locale}/></Suspense>}
      workspaceLabel={t.app.workspace} skipLabel={t.nav.skip}>
      {children}
    </DashboardFrame>
  );
}

// The signed-in person's email, shown on the account card.
async function Account({ admin }: { admin: React.ReactNode }) {
  const { data } = await (await createClient()).auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email : "";
  return <AccountMenu admin={admin} email={email} />;
}
