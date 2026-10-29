import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { BrandBrief } from "@/lib/ai/claude";
import { GENERATION_COST } from "@/lib/pipeline";
import {
  LENGTHS,
  VIDEOS_PER_GENERATION,
  videoRunCost,
  DEFAULT_VIDEO_OPTIONS,
} from "@/lib/video-options";
import { getBrandKit } from "@/lib/brand-kit";
import { DEFAULT_LANGUAGE, isLanguageKey } from "@/lib/languages";
import { GenerateControls } from "./generate-controls";
import { AutoRefresh } from "./auto-refresh";
import { BackLink, EmptyState } from "../../ui";
import { GenerationBlock, type Generation } from "./generation-block";
import { isShowcaseAdmin } from "@/lib/showcase";
import { isLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { AppText } from "../../i18n-text";
import { fmt } from "@/i18n/format";

export const maxDuration = 300;

export default function ProductPage({
  params,
}: PageProps<"/[locale]/dashboard/products/[id]">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <BackLink href="/dashboard">
        <AppText k="allProducts" />
      </BackLink>
      <Suspense
        fallback={
          <p className="mt-6 text-sm text-muted">
            <AppText k="loading" />
          </p>
        }
      >
        <Product params={params} />
      </Suspense>
    </main>
  );
}

async function Product({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getMessages(locale);
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
        "id, type, status, error, created_at, showcased_at, cost_credits, creatives(id, kind, aspect, angle, headline, primary_text, cta)",
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
  const photo = (product.image_urls as string[] | null)?.[0];
  const running = (generations ?? []).filter(
    (g) => g.status === "queued" || g.status === "running",
  );

  return (
    <>
      <AutoRefresh
        active={running.length > 0}
        videoRuns={running
          .filter((g) => g.type === "video_ads")
          .map((g) => g.id)}
      />
      <header className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element -- the store's own photo, on any host
            <img
              src={photo}
              alt=""
              className="h-16 w-16 shrink-0 rounded-xl border border-line object-cover"
            />
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {product.name ?? product.url}
            </h1>
            <a
              href={product.url}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 block truncate text-sm text-muted transition hover:text-accent"
            >
              {product.url}
            </a>
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 rounded-2xl border border-line bg-raised p-4 lg:items-end">
          <GenerateControls
            productId={product.id}
            imageCost={GENERATION_COST}
            videoCost={videoRunCost(DEFAULT_VIDEO_OPTIONS.length)}
            videoLabel={fmt(t.app.generateVideos, {
              count: VIDEOS_PER_GENERATION,
            })}
            defaultLanguage={
              isLanguageKey(brief?.language)
                ? brief?.language
                : DEFAULT_LANGUAGE
            }
          />
          <p className="text-xs text-muted">
            {fmt(t.app.creditsLeft, { count: workspace?.credits ?? 0 })}
          </p>
        </div>
      </header>

      {brief && (
        <section className="edge mt-8 grid gap-6 p-6 text-sm sm:grid-cols-2">
          <div>
            <h2 className="flex items-center gap-2 font-medium">
              {t.app.brief}
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-normal text-accent">
                {t.app.writtenBy}
              </span>
            </h2>
            <p className="mt-2 leading-relaxed text-muted">{brief.summary}</p>
            <dl className="mt-4 space-y-2">
              <div>
                <dt className="inline font-medium">{t.app.audience}</dt>
                <dd className="inline text-muted">{brief.audience}</dd>
              </div>
              <div>
                <dt className="inline font-medium">{t.app.tone}</dt>
                <dd className="inline text-muted">{brief.tone}</dd>
              </div>
            </dl>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <BriefList title={t.app.pains} items={brief.pain_points} />
            <BriefList title={t.app.benefits} items={brief.benefits} />
          </div>
        </section>
      )}

      <section className="mt-10 flex flex-col gap-10">
        {(generations ?? []).length === 0 && (
          <EmptyState title={t.app.noAds}>
            {fmt(t.app.noAdsBody, {
              videos: VIDEOS_PER_GENERATION,
              // The shortest to the longest length on offer, e.g. "7–30".
              seconds: `${Object.keys(LENGTHS)[0]}–${Object.keys(LENGTHS).at(-1)}`,
            })}
          </EmptyState>
        )}
        {(generations ?? []).map((g) => (
          <GenerationBlock
            key={g.id}
            t={t}
            locale={locale}
            generation={g}
            imageVersion={imageVersion}
            canShowcase={canShowcase}
          />
        ))}
      </section>
    </>
  );
}

function BriefList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="font-medium">{title}</p>
      <ul className="mt-2 space-y-1.5 text-muted">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-accent" aria-hidden>
              •
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
