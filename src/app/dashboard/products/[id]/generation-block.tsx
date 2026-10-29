import { setShowcase } from "./showcase-actions";
import { VIDEO_SECONDS, VIDEOS_PER_GENERATION } from "@/lib/video";
import { Chip, DownloadIcon, ProgressCard, smallButton } from "../../ui";

type Creative = {
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
  creatives: Creative[];
};

export function GenerationBlock({
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

  const video = g.type === "video_ads";

  if (g.status === "queued" || g.status === "running") {
    return (
      <ProgressCard
        title={video ? "Making your video ads…" : "Generating your ads…"}
      >
        {video
          ? `Writing ${VIDEOS_PER_GENERATION} scripts, setting up two shots per ad, recording the voiceover and music, then filming and editing. This usually takes 4–8 minutes; this page updates on its own. If you leave, the videos are finished when you come back.`
          : "Writing copy and creating 10 images. This usually takes 2–3 minutes; this page updates on its own."}
      </ProgressCard>
    );
  }

  if (g.status === "failed") {
    return (
      <div className="rounded-2xl border border-danger/30 bg-danger-bg p-6 text-sm">
        <p className="font-medium text-danger">
          This run failed, and your credits were refunded.
        </p>
        {g.error && <p className="mt-1 text-muted">{g.error}</p>}
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
        <h2 className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-medium">
            {video
              ? `${creatives.length} video ${creatives.length === 1 ? "ad" : "ads"}`
              : `${creatives.length} image ads`}
          </span>
          <span className="text-muted">{when}</span>
          {g.error && <span className="text-warn">{g.error}</span>}
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
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                g.showcased_at
                  ? "border-ok/40 bg-ok-bg text-ok"
                  : "border-line-strong bg-raised hover:border-accent hover:text-accent"
              }`}
            >
              {g.showcased_at
                ? "✓ Shown on gooidy.com · Remove"
                : "Show on gooidy.com"}
            </button>
          </form>
        )}
      </div>
      <ul
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
                src={`/api/creatives/${c.id}/image?v=${imageVersion}`}
                alt={c.headline ?? "Ad creative"}
                loading="lazy"
                className={`w-full rounded-xl object-cover ${
                  c.aspect === "1:1" ? "aspect-square" : "aspect-[9/16]"
                }`}
              />
            )}
            <div className="flex flex-1 flex-col gap-2 px-1 pb-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {c.angle && <Chip>{c.angle.replace("_", " ")}</Chip>}
                <span className="text-xs text-muted">
                  {video
                    ? `Reel / TikTok · ${VIDEO_SECONDS} s`
                    : c.aspect === "1:1"
                      ? "Feed"
                      : "Story"}
                </span>
              </div>
              <p className="line-clamp-3 text-sm leading-relaxed">
                {c.primary_text}
              </p>
              <a
                href={`/api/creatives/${c.id}/${video ? "video" : "image"}?download=1`}
                className={`${smallButton} mt-auto self-start`}
              >
                <DownloadIcon />
                {video ? "Download MP4" : "Download"}
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
