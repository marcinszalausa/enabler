import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getMessages, type Messages } from "@/i18n/messages";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProductUrlForm } from "./product-url-form";
import { ProductCard, type ProductSummary } from "./product-card";
import { EmptyState } from "./ui";

// Server actions on this page scrape and call the AI; allow time for that.
export const maxDuration = 120;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/dashboard">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: (await getMessages(locale)).meta.dashboardTitle };
}

export default async function DashboardPage({
  params,
  searchParams,
}: PageProps<"/[locale]/dashboard">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getMessages(locale);
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <Suspense
        fallback={<p className="text-sm text-muted">{t.app.loading}</p>}
      >
        <Dashboard t={t} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Dashboard({
  t,
  searchParams,
}: {
  t: Messages;
  searchParams: PageProps<"/[locale]/dashboard">["searchParams"];
}) {
  const user = await getCurrentUser();
  // A link pasted on the landing page arrives as ?url=...
  const { url, deleted, favorites: favoritesOnly } = await searchParams;
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
  // Missing table (before its migration) simply means no favorites yet.
  const { data: favoriteRows } = await supabase
    .from("product_favorites")
    .select("product_id")
    .eq("user_id", user.id);
  const favoriteIds = new Set((favoriteRows ?? []).map((f) => f.product_id as string));
  // Favorites first, newest first within each group.
  const allProducts = (products ?? [])
    .map((p) => ({ ...p, favorite: favoriteIds.has(p.id) }))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite));
  const showFavorites = favoritesOnly === "1" && favoriteIds.size > 0;
  const shown = showFavorites ? allProducts.filter((p) => p.favorite) : allProducts;

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted">
            {workspace?.name ?? t.app.workspace} · {user.email}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {t.app.yourProducts}
          </h1>
        </div>
      </header>

      {deleted === "1" && <p role="status" data-product-deleted className="mt-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm">{t.remove.productDeleted}</p>}
      <p className="mt-4 max-w-2xl text-sm text-muted">{t.journey.addHint}</p>
      <div className="mt-5 flex flex-wrap gap-3"><Link href="/dashboard/campaigns" className="inline-flex min-h-11 items-center rounded-xl border border-line-strong px-4 text-sm font-medium text-accent">Plan my next campaign →</Link><Link href="/dashboard/brand" className="inline-flex min-h-11 items-center px-2 text-sm text-muted">Save my brand preferences</Link></div>

      <section id="add" className="edge mt-8 scroll-mt-24 p-6 sm:p-8">
        <h2 className="text-lg font-medium">{t.app.addTitle}</h2>
        <p className="mt-1 text-sm text-muted">{t.app.addBody}</p>
        <div className="mt-5">
          <ProductUrlForm defaultUrl={typeof url === "string" ? url : ""} />
          <p className="mt-4 text-sm text-muted">Have a Shopify store? <Link href="/dashboard/stores" className="font-medium text-accent underline">Connect it to choose from your products →</Link></p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-medium">
          {t.app.products}
          {products && products.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted">
              {products.length}
            </span>
          )}
        </h2>
        {favoriteIds.size > 0 && (
          <div className="mt-4 flex flex-wrap gap-2" data-product-filters>
            <Link href="/dashboard" aria-current={!showFavorites ? "page" : undefined} className={"inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-medium " + (!showFavorites ? "border-accent bg-accent-soft text-accent" : "border-line")}>{t.app.allProducts}</Link>
            <Link href="/dashboard?favorites=1" aria-current={showFavorites ? "page" : undefined} className={"inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-medium " + (showFavorites ? "border-accent bg-accent-soft text-accent" : "border-line")}>{t.library.favorites} {favoriteIds.size}</Link>
          </div>
        )}
        {shown.length > 0 ? (
          <ul className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4">
            <EmptyState title={t.app.noProducts}>
              {t.app.noProductsBody}
            </EmptyState>
          </div>
        )}
      </section>
    </>
  );
}
