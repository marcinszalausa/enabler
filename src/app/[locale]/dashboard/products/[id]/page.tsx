import { canEditWorkspace } from "@/lib/workspace-access";
import type { CreditReceipt } from "@/lib/generation-presentation";
import { parseCreativePreferences } from "@/lib/creative-preferences";
import { TrialCampaign } from "../../trial-campaign";
import { PersonalizationForm } from "./personalization-form";
import { randomUUID } from "node:crypto";
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
import {
  GenerationBlock,
  type AdPost,
  type Generation,
} from "./generation-block";
import { zernioConfigured } from "@/lib/social/zernio";
import { accountLimit } from "@/lib/social/limits";
import { platformName } from "@/lib/social/platforms";
import {
  formatLocal,
  nextSlots,
  parseSlots,
  toLocal,
} from "@/lib/social/schedule";
import { isShowcaseAdmin } from "@/lib/showcase";
import { isLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { AppText } from "../../i18n-text";
import { fmt } from "@/i18n/format";

export const maxDuration = 300;

export default function ProductPage({
  params,
  searchParams,
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
        <Product params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Product({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; locale: string }>;
  searchParams: PageProps<"/[locale]/dashboard/products/[id]">["searchParams"];
}) {
  const { id, locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getMessages(locale);
  const setup = (await searchParams).setup;
  const initialKind = setup === "image" || setup === "video" ? setup : undefined;
  const user = await getCurrentUser();
  const canShowcase = isShowcaseAdmin(user.email);
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("id, url, name, image_urls, brand_brief, workspace_id")
    .eq("id", id)
    .maybeSingle();
  if (!product) notFound();

  const [{ data: generations, error: generationsError }, { data: workspace }, kit, canEdit] = await Promise.all([
    supabase
      .from("generations")
      .select(
        "id, type, status, error, created_at, showcased_at, cost_credits, creatives(id, kind, aspect, angle, headline, primary_text, cta), video_jobs(status)",
      )
      .eq("product_id", id)
      .order("created_at", { ascending: false })
      .returns<Generation[]>(),
    supabase
      .from("workspaces")
      .select("credits, plan")
      .eq("id", product.workspace_id)
      .single(),
    getBrandKit(supabase, product.workspace_id),
    canEditWorkspace(supabase, product.workspace_id),
  ]);
  if (generationsError) throw generationsError;
  // Read receipts after the run snapshot: a terminal state must not race an
  // earlier receipt query and briefly look like an unconfirmed refund.
  const receiptResult = await supabase.rpc("generation_receipts", { product: id });
  if (receiptResult.error) console.error("generation receipts unavailable", receiptResult.error.code);
  const receipts = new Map<string, CreditReceipt>(
    (receiptResult.error ? [] : receiptResult.data ?? []).map((row: CreditReceipt & { generation_id: string }) => [row.generation_id, row]),
  );
  // Changes with the brand kit, so browsers refetch re-branded images.
  const imageVersion = encodeURIComponent(
    `${kit.accent_color}${kit.font}${kit.logo_path ?? ""}`,
  );

  const publishing = zernioConfigured()
    ? await publishingFor(
        supabase,
        locale,
        (generations ?? []).flatMap((g) => g.creatives.map((c) => c.id)),
        workspace?.plan,
      )
    : null;

  const brief = product.brand_brief as BrandBrief | null;
  const preferences = parseCreativePreferences(brief?.creative_preferences);
  const needsPreferences = brief?.requires_personalization === true && !preferences;
  const photo = (product.image_urls as string[] | null)?.[0];
  const running = (generations ?? []).filter(
    (g) => g.status === "queued" || g.status === "running",
  );

  return (
    <>
      <AutoRefresh
        active={running.length > 0}
        videoRuns={(canEdit ? running : [])
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
        <div id="generate-ads" tabIndex={-1} className="flex scroll-mt-24 flex-col items-start gap-2 rounded-2xl border border-line bg-raised p-4 focus:outline-2 focus:outline-accent lg:items-end">
          {canEdit && (needsPreferences ? <a href="#ad-preferences" className="inline-flex min-h-11 max-w-sm items-center text-sm font-medium text-accent hover:underline">{t.personal.confirmFirst}</a> : <GenerateControls
            key={JSON.stringify(preferences)}
            initialKind={initialKind}
            credits={workspace?.credits ?? 0}
            freeTrial={workspace?.plan === "free"}
            imageRequestId={randomUUID()}
            videoRequestId={randomUUID()}
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
          />)}
          <p className="text-xs text-muted">
            {fmt(t.app.creditsLeft, { count: workspace?.credits ?? 0 })}
          </p>
        </div>
      </header>

      {workspace?.plan==="free"&&<TrialCampaign credits={workspace.credits??0} hasAds={(generations??[]).some(g=>g.creatives.length>0)} published={Object.values(publishing?.posts??{}).some(post=>post.status==="published")} canEdit={canEdit}/>}
      {brief && canEdit && <PersonalizationForm productId={product.id} initial={preferences} audience={brief.audience} focus={brief.benefits[0]??""} benefits={brief.benefits} required={needsPreferences}/>}

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

      <section id="your-ads" className="mt-10 flex scroll-mt-24 flex-col gap-10">
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
            productUrl={product.url}
            accounts={publishing?.accounts ?? null}
            nextSlot={publishing?.nextSlot ?? null}
            posts={publishing?.posts ?? {}}
            receipt={receipts.get(g.id)}
            canRetry={canEdit}
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

// Connected accounts, the next free queue time and each ad's latest post.
async function publishingFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  locale: string,
  creativeIds: string[],
  plan: string | undefined,
) {
  const [
    { data: accounts },
    { data: schedule },
    { data: posts },
    { data: upcoming },
  ] = await Promise.all([
    supabase
      .from("social_accounts")
      .select("id, platform, username, display_name")
      .order("created_at")
      .order("id"),
    supabase
      .from("publishing_schedules")
      .select("time_zone, slots")
      .maybeSingle(),
    creativeIds.length
      ? supabase
          .from("posts")
          .select("creative_id, status, scheduled_for, results, account_ids")
          .in("creative_id", creativeIds)
          .neq("status", "cancelled")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from("posts")
      .select("scheduled_for")
      .eq("status", "scheduled")
      .gt("scheduled_for", new Date().toISOString()),
  ]);

  const timeZone = (schedule?.time_zone as string | undefined) ?? "UTC";
  const taken = new Set(
    (upcoming ?? []).map((p) => toLocal(new Date(p.scheduled_for), timeZone)),
  );
  const [next] = nextSlots(parseSlots(schedule?.slots), timeZone, taken, 1);

  const platformOf = new Map(
    (accounts ?? []).map((a) => [a.id as string, a.platform as string]),
  );
  const byCreative: Record<string, AdPost> = {};
  for (const p of posts ?? []) {
    if (!p.creative_id || byCreative[p.creative_id]) continue;
    const results = (p.results ?? []) as { platform: string }[];
    byCreative[p.creative_id] = {
      status: p.status,
      platforms: results.length
        ? results.map((r) => r.platform)
        : (p.account_ids as string[])
            .map((id) => platformOf.get(id))
            .filter((x): x is string => Boolean(x)),
      when:
        p.status === "scheduled" && p.scheduled_for
          ? formatLocal(toLocal(new Date(p.scheduled_for), timeZone), locale)
          : null,
    };
  }

  return {
    // Only the accounts the plan covers (the earliest connected).
    accounts: (accounts ?? []).slice(0, accountLimit(plan)).map((a) => ({
      id: a.id as string,
      platform: a.platform as string,
      name: (a.display_name ??
        a.username ??
        platformName(a.platform)) as string,
    })),
    nextSlot: next ? formatLocal(next, locale) : null,
    posts: byCreative,
  };
}
