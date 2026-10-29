import Link from "next/link";
import { AppBar } from "../_landing/chrome";

export default function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  return (
    <div className="flex flex-1 flex-col bg-bg text-fg">
      <AppBar>
        <Link
          href="/dashboard"
          className="rounded-lg px-3 py-2 text-muted transition hover:bg-surface hover:text-fg"
        >
          Products
        </Link>
        <Link
          href="/dashboard/brand"
          className="rounded-lg px-3 py-2 text-muted transition hover:bg-surface hover:text-fg"
        >
          Brand kit
        </Link>
        <form action="/auth/signout" method="post">
          <button className="rounded-lg px-3 py-2 text-muted transition hover:bg-surface hover:text-fg">
            Sign out
          </button>
        </form>
      </AppBar>
      {children}
    </div>
  );
}
