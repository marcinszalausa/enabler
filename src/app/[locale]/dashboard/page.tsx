import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getMessages, type Messages } from "@/i18n/messages";
import { fmt } from "@/i18n/format";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProductUrlForm } from "./product-url-form";
import { ProductCard, type ProductSummary } from "./product-card";
import { CreditsBadge, EmptyState } from "./ui";

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
            {workspace?.name ?? t.app.workspace} · {user.email}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {t.app.yourProducts}
          </h1>
        </div>
        <CreditsBadge
          credits={fmt(t.app.credits, { count: workspace?.credits ?? 0 })}
          plan={fmt(t.app.plan, { plan: planName(t, workspace?.plan) })}
        />
      </header>

      <section className="edge mt-8 p-6 sm:p-8">
        <h2 className="text-lg font-medium">{t.app.addTitle}</h2>
        <p className="mt-1 text-sm text-muted">{t.app.addBody}</p>
        <div className="mt-5">
          <ProductUrlForm defaultUrl={typeof url === "string" ? url : ""} />
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
            <EmptyState title={t.app.noProducts}>
              {t.app.noProductsBody}
            </EmptyState>
          </div>
        )}
      </section>
    </>
  );
}

// Plan names are the pricing table's, in the page's language.
function planName(t: Messages, plan: string | null | undefined) {
  const i = ["free", "starter", "growth"].indexOf(plan ?? "free");
  return t.home.plans[i]?.name ?? plan ?? "";
}
