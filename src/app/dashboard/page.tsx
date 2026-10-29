import { Suspense } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProductUrlForm } from "./product-url-form";
import { planName } from "@/lib/billing";

// Server actions on this page scrape and call the AI; allow time for that.
export const maxDuration = 120;

export const metadata = { title: "Dashboard · Gooidy" };

export default function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Dashboard({
  searchParams,
}: {
  searchParams: PageProps<"/dashboard">["searchParams"];
}) {
  const user = await getCurrentUser();
  // A link pasted on the landing page arrives as ?url=...
  const { url } = await searchParams;
  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, plan, credits")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const { data: products } = workspace
    ? await supabase
        .from("products")
        .select("id, name, url, created_at")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <>
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {workspace?.name ?? "Your workspace"}
          </h1>
          <p className="text-sm text-neutral-500">
            {user.email} · {planName(workspace?.plan ?? "free")} plan ·{" "}
            {workspace?.credits ?? 0} credits
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/billing"
            className="text-sm underline underline-offset-4"
          >
            Billing
          </Link>
          <Link
            href="/dashboard/brand"
            className="text-sm underline underline-offset-4"
          >
            Brand kit
          </Link>
          <form action="/auth/signout" method="post">
            <button className="text-sm underline underline-offset-4">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="mt-10">
        <ProductUrlForm defaultUrl={typeof url === "string" ? url : ""} />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Products</h2>
        {products && products.length > 0 ? (
          <ul className="mt-4 divide-y divide-neutral-200 dark:divide-neutral-800">
            {products.map((p) => (
              <li key={p.id} className="py-3">
                <Link href={`/dashboard/products/${p.id}`} className="block">
                  <p className="font-medium">{p.name ?? p.url}</p>
                  <p className="truncate text-sm text-neutral-500">{p.url}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-md border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 dark:border-neutral-700">
            No products yet. Paste a product link above to get started.
          </p>
        )}
      </section>
    </>
  );
}
