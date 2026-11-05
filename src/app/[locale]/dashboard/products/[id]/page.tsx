import {paidPlan,paidPlanName} from "@/lib/paid-plans";
import { parseCampaign } from "@/lib/customer-workflow";
import { CampaignBundle } from "../../campaigns/campaign-bundle";
import { canEditWorkspace } from "@/lib/workspace-access";
import type { CreditReceipt } from "@/lib/generation-presentation";
import { parseCreativePreferences } from "@/lib/creative-preferences";
import { PersonalizationForm } from "./personalization-form";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { BrandBrief } from "@/lib/ai/claude";
import {
  LENGTHS,
  VIDEOS_PER_GENERATION,
} from "@/lib/video-options";
import { getBrandKit } from "@/lib/brand-kit";
import { DEFAULT_LANGUAGE, isLanguageKey } from "@/lib/languages";
import { GenerateControls, type TierExampleIds } from "./generate-controls";
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
import { getTierExamples, isShowcaseAdmin } from "@/lib/showcase";
import { QUALITIES } from "@/lib/quality";
import { isLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { AppText } from "../../i18n-text";
import { ProductMenu } from "./product-menu";
import { FailedBatches } from "./failed-batches";
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
  const query = await searchParams;
  const selectedPlan=paidPlan(query.plan);
  const setup = query.setup;
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
  const selectedCampaignId = typeof query.campaign === "string" ? query.campaign : null;
  let campaign = null;
  if (selectedCampaignId) {
    const {data:plan,error:planError}=await supabase.from("campaigns").select("id,name,goal,message,offer,scene").eq("id",selectedCampaignId).eq("workspace_id",product.workspace_id).eq("product_id",product.id).maybeSingle();
    if (planError) throw planError;
    campaign=parseCampaign(plan);
    if(!campaign) notFound();
  }

  const [{ data: generations, error: generationsError }, { data: workspace }, kit, canEdit] = await Promise.all([
    supabase
      .from("generations")
      .select(
        "id, type, status, error, created_at, showcased_at, cost_credits, request_options, creatives(id, kind, aspect, angle, headline, primary_text, cta), video_jobs(status)",
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
  // A finished run whose ads were all deleted has nothing left to show.
  const visibleRuns = (generations ?? []).filter((g) => !(g.status === "succeeded" && g.creatives.length === 0));
  const campaignRuns = campaign ? visibleRuns.filter(g => parseCampaign((g.request_options as {campaign?:unknown}|null)?.campaign)?.id === campaign.id) : visibleRuns;
  // Failed batches with no saved ads fold into one quiet row.
  const emptyFailed = campaignRuns.filter(g => g.status === "failed" && g.creatives.length === 0);
  const shownRuns = campaignRuns.filter(g => !emptyFailed.includes(g));
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

  const creativeIds = (generations ?? []).flatMap((g) => g.creatives.map((c) => c.id));
  const { data: favoriteRows } = creativeIds.length
    ? await supabase.from("creative_favorites").select("creative_id").eq("user_id", user.id).in("creative_id", creativeIds)
    : { data: [] as { creative_id: string }[] };
  const favorites = (favoriteRows ?? []).map((f) => f.creative_id as string);

  const publishing = zernioConfigured()
    ? await publishingFor(
        supabase,
        locale,
        creativeIds,
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

  // One real showcased ad per quality tier, shown beside the tier picker.
  const [imageTiers, videoTiers] = await Promise.all([getTierExamples("image_ads"), getTierExamples("video_ads")]);
  const tierExamples = {
    image: Object.fromEntries(QUALITIES.map((q) => [q, (imageTiers[q]?.ads.find((a) => a.aspect === "1:1") ?? imageTiers[q]?.ads[0])?.id ?? null])),
    video: Object.fromEntries(QUALITIES.map((q) => [q, videoTiers[q]?.ads[0]?.id ?? null])),
  } as TierExampleIds;

  const credits = workspace?.credits ?? 0;
  const creditNote = workspace?.plan === "free"
    ? `${fmt(t.app.creditsLeft, { count: credits })} · ${t.trial.oneTime}`
    : fmt(t.app.creditsLeft, { count: credits });

  return (
    <>
      <AutoRefresh
        active={running.length > 0}
        videoRuns={(canEdit ? running : [])
          .filter((g) => g.type === "video_ads")
          .map((g) => g.id)}
      />
      {selectedPlan&&<section data-selected-plan={selectedPlan} className="mt-6 rounded-xl border border-line bg-surface p-4 text-sm"><p className="font-medium">Selected plan: {paidPlanName(selectedPlan)}</p><p className="mt-2 text-xs text-muted">This is a preference only. Your current credits and access are unchanged. No subscription has been started.</p></section>}
      <header className="mt-5 flex items-center gap-4">
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- the store's own photo, on any host
          <img
            src={photo}
            alt=""
            className="h-14 w-14 shrink-0 rounded-xl border border-line object-cover sm:h-16 sm:w-16"
          />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-3xl">
            {product.name ?? product.url}
          </h1>
          <a
            href={product.url}
            target="_blank"
            rel="noreferrer"
            dir="ltr"
            className="mt-0.5 block truncate text-start text-sm text-muted transition hover:text-accent rtl:text-end"
          >
            {product.url.replace(/^https?:\/\/(www\.)?/, "")}
          </a>
        </div>
        <ProductMenu productId={product.id} hasBrief={Boolean(brief)} canEdit={canEdit} />
      </header>
      {campaign && <CampaignBundle campaign={campaign} copy={campaignRuns.flatMap(g=>g.creatives)}/>}

      {canEdit && (
        <section id="generate-ads" tabIndex={-1} aria-labelledby="create-ads-title" className="mt-6 flex scroll-mt-40 flex-col gap-4 rounded-2xl border border-line bg-raised p-4 focus:outline-2 focus:outline-accent sm:p-6">
          <h2 id="create-ads-title" className="text-lg font-semibold">{t.journey.create}</h2>
          {brief && <PersonalizationForm productId={product.id} initial={preferences} audience={brief.audience} focus={brief.benefits[0]??""} benefits={brief.benefits} required={needsPreferences}/>}
          {running.length > 0 ? (
            <a href="#your-ads" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line-strong px-4 text-sm font-medium text-accent hover:border-accent">{t.run.check}<span aria-hidden>↓</span></a>
          ) : needsPreferences ? null : (
            <GenerateControls
              key={JSON.stringify(preferences)}
              campaignId={campaign?.id}
              initialKind={initialKind}
              credits={workspace?.credits ?? 0}
              freeTrial={workspace?.plan === "free"}
              imageRequestId={randomUUID()}
              videoRequestId={randomUUID()}
              productId={product.id}
              examples={tierExamples}
              defaultPhoto={photo ?? null}
              videoLabel={fmt(t.app.generateVideos, {
                count: VIDEOS_PER_GENERATION,
              })}
              defaultLanguage={
                isLanguageKey(brief?.language)
                  ? brief?.language
                  : DEFAULT_LANGUAGE
              }
            />
          )}
          <p className="-mt-1 text-center text-xs leading-relaxed text-muted lg:text-start">{creditNote}</p>
        </section>
      )}

      <section id="your-ads" tabIndex={-1} aria-labelledby="your-ads-title" className="mt-10 scroll-mt-40">
        <h2 id="your-ads-title" className="text-lg font-semibold">{t.app.yourAds}</h2>
        {campaign && <p className="mt-2 text-sm text-muted">Showing ads from this campaign. <a className="text-accent underline" href={`/dashboard/products/${product.id}`}>View all product ads</a></p>}
        <div className="mt-3">
          <FailedBatches t={t} locale={locale} runs={emptyFailed} receipts={receipts} canRetry={canEdit} />
        </div>
        <div className="mt-4 flex flex-col gap-10">
        {shownRuns.length === 0 && (
          <EmptyState title={t.app.noAds}>
            {fmt(t.app.noAdsBody, {
              videos: VIDEOS_PER_GENERATION,
              // The shortest to the longest length on offer, e.g. "7–30".
              seconds: `${Object.keys(LENGTHS)[0]}–${Object.keys(LENGTHS).at(-1)}`,
            })}
          </EmptyState>
        )}
        {shownRuns.map((g) => (
          <GenerationBlock
            key={g.id}
            t={t}
            locale={locale}
            generation={g}
            imageVersion={imageVersion}
            canShowcase={canShowcase}
            productUrl={product.url}
            productId={product.id}
            workspaceId={product.workspace_id}
            accounts={publishing?.accounts ?? null}
            nextSlot={publishing?.nextSlot ?? null}
            posts={publishing?.posts ?? {}}
            receipt={receipts.get(g.id)}
            favorites={favorites}
            canRetry={canEdit}
          />
        ))}
        </div>
      </section>
      {brief && (
        <details id="brand-brief" className="mt-10 scroll-mt-40 border-t border-line pt-2 text-sm">
          <summary className="min-h-11 cursor-pointer content-center font-medium text-muted hover:text-fg">{t.app.brief}</summary>
          <div className="grid gap-6 pt-3 pb-2 sm:grid-cols-2">
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
          </div>
        </details>
      )}

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
