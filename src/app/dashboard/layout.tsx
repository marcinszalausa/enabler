import Link from "next/link";
import { AppBar } from "../_landing/chrome";
import { Spotlight } from "../_landing/spotlight";

const navLink =
  "rounded-lg px-3 py-2 text-muted transition hover:bg-surface hover:text-fg";

export default function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  // "landing" gives the app the site's cards and hover effects.
  return (
    <div className="landing flex flex-1 flex-col bg-bg text-fg">
      <AppBar>
        <Link href="/dashboard" className={navLink}>
          Products
        </Link>
        <Link href="/dashboard/brand" className={navLink}>
          Brand kit
        </Link>
        <form action="/auth/signout" method="post">
          <button className={navLink}>Sign out</button>
        </form>
      </AppBar>
      {children}
      <Spotlight />
    </div>
  );
}
