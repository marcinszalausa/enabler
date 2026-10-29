import Link from "next/link";
import { AppBar } from "@/app/_landing/chrome";
import { Spotlight } from "@/app/_landing/spotlight";
import { isLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { notFound } from "next/navigation";

const navLink =
  "rounded-lg px-3 py-2 text-muted transition hover:bg-surface hover:text-fg";

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
      <AppBar>
        <Link href="/dashboard" className={navLink}>
          {t.app.products}
        </Link>
        <Link href="/dashboard/brand" className={navLink}>
          {t.app.brandKit}
        </Link>
        <form action="/auth/signout" method="post">
          <button className={navLink}>{t.app.signOut}</button>
        </form>
      </AppBar>
      {children}
      <Spotlight />
    </div>
  );
}
