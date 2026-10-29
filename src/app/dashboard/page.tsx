import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProductUrlForm } from "./product-url-form";
import { ProductCard, type ProductSummary } from "./product-card";
import { CreditsBadge, EmptyState } from "./ui";

// Server actions on this page scrape and call the AI; allow time for that.
export const maxDuration = 120;

export const metadata = { title: "Dashboard · Gooidy" };

export default function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
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
        .select("id, name, url, image_urls, created_at")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false })
        .returns<ProductSummary[]>()
    : { data: [] as ProductSummary[] };

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted">
            {workspace?.name ?? "Your workspace"} · {user.email}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Your products
          </h1>
        </div>
        <CreditsBadge
          credits={workspace?.credits ?? 0}
          plan={workspace?.plan ?? "free"}
        />
      </header>

      <section className="edge mt-8 p-6 sm:p-8">
        <h2 className="text-lg font-medium">Make ads from a product link</h2>
        <p className="mt-1 text-sm text-muted">
          Paste a product page. Gooidy reads it, writes a brand brief and gets
          it ready for ads.
        </p>
        <div className="mt-5">
          <ProductUrlForm defaultUrl={typeof url === "string" ? url : ""} />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-medium">
          Products
          {products && products.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted">
              {products.length}
            </span>
          )}
        </h2>
        {products && products.length > 0 ? (
          <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4">
            <EmptyState title="No products yet">
              Paste a product link above. In about two minutes you&apos;ll have
              your first five ads.
            </EmptyState>
          </div>
        )}
      </section>
    </>
  );
}
