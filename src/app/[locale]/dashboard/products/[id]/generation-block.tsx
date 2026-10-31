import {AdGallery} from "./ad-gallery";
import { setShowcase } from "./showcase-actions";
import { DEFAULT_VIDEO_OPTIONS, lengthForRunCost } from "@/lib/video-options";
import { Chip, DownloadIcon, smallButton } from "../../ui";
import {
  PublishDialog,
  type PublishAccount,
} from "./publish-dialog";
import { platformName } from "@/lib/social/platforms";
import type { Messages } from "@/i18n/messages";
import { fmt } from "@/i18n/format";
import { GenerationStatus } from "./generation-status";
import { generationPresentation, type CreditReceipt } from "@/lib/generation-presentation";

// The latest post of an ad, for the line under it.
export type AdPost = {
  status: keyof Messages["publish"]["status"];
  platforms: string[];
  // Already worded in the page's language and the schedule's time zone.
  when: string | null;
};

export type Creative = {
  id: string;
  kind: "image" | "video";
  aspect: string;
  angle: string | null;
  headline: string | null;
  primary_text: string | null;
  cta: string | null;
};

export type Generation = {
  id: string;
  type: string;
  status: "queued" | "running" | "succeeded" | "failed";
  error: string | null;
  created_at: string;
  showcased_at: string | null;
  cost_credits: number;
  creatives: Creative[];
  video_jobs?: { status: string }[];
};

export function GenerationBlock({
  t,
  locale,
  generation: g,
  imageVersion,
  canShowcase,
  productUrl,
  accounts,
  nextSlot,
  posts,
  receipt,
  canRetry = false,
  productId,
  workspaceId,
}: {
  t: Messages;
  locale: string;
  generation: Generation;
  imageVersion: string;
  canShowcase: boolean;
  productUrl: string;
  accounts: PublishAccount[] | null;
  nextSlot: string | null;
  posts: Record<string, AdPost>;
  receipt?: CreditReceipt | null;
  canRetry?: boolean;
  productId?: string;
  workspaceId?: string;
}) {
  const when = new Date(g.created_at).toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const video = g.type === "video_ads";
  // A run's length isn't stored; every length has its own price.
  const seconds = Number(lengthForRunCost(g.cost_credits) ?? DEFAULT_VIDEO_OPTIONS.length);

  const view = generationPresentation(g);

  const creatives = [...g.creatives].sort(
    (a, b) =>
      (a.headline ?? "").localeCompare(b.headline ?? "") ||
      a.aspect.localeCompare(b.aspect),
  );

  return (
    <div id={`ad-${g.id}`} className="scroll-mt-24">
      <GenerationStatus t={t} generation={g} receipt={receipt} canRetry={canRetry} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-medium">
            {fmt(
              video
                ? creatives.length === 1
                  ? t.app.videoAd
                  : t.app.videoAds
                : t.app.imageAds,
              { count: creatives.length },
            )}
          </span>
          <span className="text-muted">{when}</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {canRetry && accounts && !view.active && g.status === "succeeded" && creatives.length > 0 && (
            <PublishDialog
              generationId={g.id}
              creatives={creatives.map((c) => ({
                id: c.id,
                kind: c.kind,
                aspect: c.aspect,
                caption: [c.primary_text, productUrl]
                  .filter(Boolean)
                  .join("\n\n"),
              }))}
              accounts={accounts}
              nextSlot={nextSlot}
            />
          )}
          {canShowcase && g.status === "succeeded" && creatives.length > 0 && (
            <form action={setShowcase}>
              <input type="hidden" name="generationId" value={g.id} />
              <input
                type="hidden"
                name="show"
                value={g.showcased_at ? "0" : "1"}
              />
              <button
                type="submit"
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  g.showcased_at
                    ? "border-ok/40 bg-ok-bg text-ok"
                    : "border-line-strong bg-raised hover:border-accent hover:text-accent"
                }`}
              >
                {g.showcased_at ? t.app.shown : t.app.show}
              </button>
            </form>
          )}
        </div>
      </div>
      {!view.active&&creatives.length>0?<AdGallery creatives={creatives} generationId={g.id} imageVersion={imageVersion} seconds={seconds} canPublish={canRetry&&accounts!==null&&g.status==="succeeded"} productId={productId} workspaceId={workspaceId} posts={posts}/>:<ul
        className={`mt-4 grid grid-cols-2 items-start gap-4 ${video ? "md:grid-cols-3" : "md:grid-cols-4"}`}
      >
        {creatives.map((c) => (
          <li
            key={c.id}
            className="spot lift flex flex-col gap-3 rounded-2xl border border-line bg-raised p-2.5"
          >
            {video ? (
              <video
                src={`/api/creatives/${c.id}/video`}
                controls
                playsInline
                loop
                preload="metadata"
                className="aspect-[9/16] w-full rounded-xl bg-surface object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- rendered on demand by our own route
              <img
                src={`/api/creatives/${c.id}/image?preview=1&layout=face-safe-v1&v=${imageVersion}`}
                alt={c.headline ?? "Ad creative"}
                loading="lazy"
                className={`w-full rounded-xl object-cover ${
                  c.aspect === "1:1" ? "aspect-square" : "aspect-[9/16]"
                }`}
              />
            )}
            <div className="flex flex-1 flex-col gap-2 px-1 pb-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {c.angle && (
                  <Chip>
                    {t.angles[c.angle as keyof Messages["angles"]]?.name ??
                      c.angle.replace("_", " ")}
                  </Chip>
                )}
                <span className="text-xs text-muted">
                  {video
                    ? fmt(t.app.reel, { seconds })
                    : c.aspect === "1:1"
                      ? t.app.feedSize
                      : t.app.storySize}
                </span>
              </div>
              <p className="line-clamp-3 text-sm leading-relaxed">
                {c.primary_text}
              </p>
              {posts[c.id] && <PostLine t={t} post={posts[c.id]} />}
              <div className="mt-auto flex flex-wrap gap-2">
                <a
                  href={`/api/creatives/${c.id}/${video ? "video" : "image"}?download=1&layout=face-safe-v1`}
                  className={smallButton}
                >
                  <DownloadIcon />
                  {video ? t.app.downloadMp4 : t.app.download}
                </a>
              </div>
            </div>
          </li>
        ))}
      </ul>}

    </div>
  );
}

function PostLine({ t, post }: { t: Messages; post: AdPost }) {
  const tone =
    post.status === "published"
      ? "text-ok"
      : post.status === "failed" || post.status === "partial"
        ? "text-danger"
        : "text-accent";
  return (
    <p className={`text-xs ${tone}`}>
      <span className="font-medium">{t.publish.status[post.status]}</span>
      {post.when && ` · ${post.when}`}
      {post.platforms.length > 0 &&
        ` · ${post.platforms.map(platformName).join(", ")}`}
    </p>
  );
}
