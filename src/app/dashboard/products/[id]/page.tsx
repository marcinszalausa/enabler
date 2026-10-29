import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { BrandBrief } from "@/lib/ai/claude";
import { GENERATION_COST } from "@/lib/pipeline";
import { getBrandKit } from "@/lib/brand-kit";
import { GenerateButton } from "./generate-button";
import { AutoRefresh } from "./auto-refresh";
import { setShowcase } from "./showcase-actions";
import { isShowcaseAdmin } from "@/lib/showcase";

export const maxDuration = 300;
export const metadata = { title: "Product · Gooidy" };

export default function ProductPage({
  params,
}: PageProps<"/dashboard/products/[id]">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <Link
        href="/dashboard"
        className="text-sm text-neutral-500 underline underline-offset-4"
      >
        ← All products
      </Link>
      <Suspense
        fallback={<p className="mt-6 text-sm text-neutral-500">Loading…</p>}
      >
        <Product params={params} />
      </Suspense>
    </main>
  );
}

type Creative = {
  id: string;
  aspect: string;
  angle: string | null;
  headline: string | null;
  primary_text: string | null;
  cta: string | null;
};

type Generation = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  error: string | null;
  created_at: string;
  showcased_at: string | null;
  creatives: Creative[];
};

async function Product({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const canShowcase = isShowcaseAdmin(user.email);
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("id, url, name, image_urls, brand_brief, workspace_id")
    .eq("id", id)
    .maybeSingle();
  if (!product) notFound();

  const [{ data: generations }, { data: workspace }, kit] = await Promise.all([
    supabase
      .from("generations")
      .select(
        "id, status, error, created_at, showcased_at, creatives(id, aspect, angle, headline, primary_text, cta)",
      )
      .eq("product_id", id)
      .order("created_at", { ascending: false })
      .returns<Generation[]>(),
    supabase
      .from("workspaces")
      .select("credits")
      .eq("id", product.workspace_id)
      .single(),
    getBrandKit(supabase, product.workspace_id),
  ]);
  // Changes with the brand kit, so browsers refetch re-branded images.
  const imageVersion = encodeURIComponent(
    `${kit.accent_color}${kit.font}${kit.logo_path ?? ""}`,
  );

  const brief = product.brand_brief as BrandBrief | null;
  const active = (generations ?? []).some(
    (g) => g.status === "queued" || g.status === "running",
  );

  return (
    <>
      <AutoRefresh active={active} />
      <header className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">
            {product.name ?? product.url}
          </h1>
          <a
            href={product.url}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-sm text-neutral-500 underline underline-offset-4"
          >
            {product.url}
          </a>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <GenerateButton productId={product.id} cost={GENERATION_COST} />
          <p className="text-xs text-neutral-500">
            {workspace?.credits ?? 0} credits left
          </p>
        </div>
      </header>

      {brief && (
        <section className="mt-8 grid gap-4 rounded-lg border border-neutral-200 p-5 text-sm sm:grid-cols-2 dark:border-neutral-800">
          <div>
            <h2 className="font-medium">Brand brief</h2>
            <p className="mt-1 text-neutral-600 dark:text-neutral-400">
              {brief.summary}
            </p>
            <p className="mt-3">
              <span className="font-medium">Audience:</span> {brief.audience}
            </p>
            <p className="mt-1">
              <span className="font-medium">Tone:</span> {brief.tone}
            </p>
          </div>
          <div>
            <p className="font-medium">Pain points</p>
            <ul className="mt-1 list-disc pl-5 text-neutral-600 dark:text-neutral-400">
              {brief.pain_points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <p className="mt-3 font-medium">Benefits</p>
            <ul className="mt-1 list-disc pl-5 text-neutral-600 dark:text-neutral-400">
              {brief.benefits.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="mt-10 flex flex-col gap-10">
        {(generations ?? []).length === 0 && (
          <p className="rounded-md border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 dark:border-neutral-700">
            No ads yet. Generate your first set: 5 ad angles, each as a square
            (feed) and a vertical (stories/reels) image.
          </p>
        )}
        {(generations ?? []).map((g) => (
          <GenerationBlock
            key={g.id}
            generation={g}
            imageVersion={imageVersion}
            canShowcase={canShowcase}
          />
        ))}
      </section>
    </>
  );
}

function GenerationBlock({
  generation: g,
  imageVersion,
  canShowcase,
}: {
  generation: Generation;
  imageVersion: string;
  canShowcase: boolean;
}) {
  const when = new Date(g.created_at).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  if (g.status === "queued" || g.status === "running") {
    return (
      <div className="rounded-lg border border-neutral-200 p-6 text-sm dark:border-neutral-800">
        <p className="font-medium">Generating your ads…</p>
        <p className="mt-1 text-neutral-500">
          Writing copy and creating 10 images. This usually takes 2–3 minutes;
          this page updates on its own.
        </p>
      </div>
    );
  }

  if (g.status === "failed") {
    return (
      <div className="rounded-lg border border-red-200 p-6 text-sm dark:border-red-900">
        <p className="font-medium text-red-600">
          This run failed, and your credits were refunded.
        </p>
        {g.error && <p className="mt-1 text-neutral-500">{g.error}</p>}
      </div>
    );
  }

  const creatives = [...g.creatives].sort(
    (a, b) =>
      (a.headline ?? "").localeCompare(b.headline ?? "") ||
      a.aspect.localeCompare(b.aspect),
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-neutral-500">
          {when}
          {g.error && <span className="ml-2 text-amber-600">{g.error}</span>}
        </h2>
        {canShowcase && (
          <form action={setShowcase}>
            <input type="hidden" name="generationId" value={g.id} />
            <input
              type="hidden"
              name="show"
              value={g.showcased_at ? "0" : "1"}
            />
            <button
              type="submit"
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium dark:border-neutral-700"
            >
              {g.showcased_at
                ? "✓ Shown on gooidy.com · Remove"
                : "Show on gooidy.com"}
            </button>
          </form>
        )}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
        {creatives.map((c) => (
          <li key={c.id} className="flex flex-col gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- rendered on demand by our own route */}
            <img
              src={`/api/creatives/${c.id}/image?v=${imageVersion}`}
              alt={c.headline ?? "Ad creative"}
              loading="lazy"
              className={`w-full rounded-md border border-neutral-200 object-cover dark:border-neutral-800 ${
                c.aspect === "1:1" ? "aspect-square" : "aspect-[9/16]"
              }`}
            />
            <p className="text-xs text-neutral-500">
              {c.angle?.replace("_", " ")} ·{" "}
              {c.aspect === "1:1" ? "Feed" : "Story"}
            </p>
            <p className="text-sm">{c.primary_text}</p>
            <a
              href={`/api/creatives/${c.id}/image?download=1`}
              className="text-sm font-medium underline underline-offset-4"
            >
              Download
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
