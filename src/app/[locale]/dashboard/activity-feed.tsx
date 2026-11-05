import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { fmt } from "@/i18n/format";
import { createClient } from "@/lib/supabase/server";
import { generationPresentation, type RunSnapshot } from "@/lib/generation-presentation";
import { platformName } from "@/lib/social/platforms";
import { ActiveRuns, LocalTime } from "./activity-panel";

type Run = RunSnapshot & {
  id: string;
  product_id: string | null;
  products: { name: string | null } | null;
};
type Post = { id: string; caption: string | null; scheduled_for: string; account_ids: string[]; creative_id: string | null };

const section = "mb-2 mt-6 text-xs font-semibold tracking-wide text-muted uppercase first:mt-0";

// The right-hand Activity panel: ads being made now, posts coming up and the
// newest finished ads. Read-only; it never starts or changes anything.
export async function ActivityFeed({ locale }: { locale: Locale }) {
  const t = await getMessages(locale);
  const supabase = await createClient();
  const now = new Date();
  // Runs older than a day are stale, whatever their status says.
  const since = new Date(now.getTime() - 86_400_000).toISOString();
  const [{ data: runs }, { data: posts }, { data: recent }, { data: accounts }] = await Promise.all([
    supabase
      .from("generations")
      .select("id, type, status, cost_credits, request_options, product_id, products(name), creatives(kind), video_jobs(status)")
      .in("status", ["queued", "running"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(4)
      .returns<Run[]>(),
    supabase
      .from("posts")
      .select("id, caption, scheduled_for, account_ids, creative_id")
      .eq("status", "scheduled")
      .gte("scheduled_for", now.toISOString())
      .order("scheduled_for")
      .limit(3)
      .returns<Post[]>(),
    supabase
      .from("creatives")
      .select("id")
      .eq("kind", "image")
      .order("created_at", { ascending: false })
      .limit(6)
      .returns<{ id: string }[]>(),
    supabase.from("social_accounts").select("id, platform").returns<{ id: string; platform: string }[]>(),
  ]);
  const platformOf = new Map((accounts ?? []).map((a) => [a.id, platformName(a.platform)]));
  const active = runs ?? [];

  return (
    <div data-activity-feed>
      <ActiveRuns count={active.length} />
      <h3 className={section}>{t.activity.makingNow}</h3>
      {active.length ? (
        <ul className="flex flex-col gap-2">
          {active.map((run) => {
            const view = generationPresentation(run);
            const percent = view.total ? Math.round((Math.min(view.saved, view.total) / view.total) * 100) : 0;
            return (
              <li key={run.id}>
                <Link
                  href={run.product_id ? `/dashboard/products/${run.product_id}` : "/dashboard/ads"}
                  className="block rounded-2xl border border-line p-3 transition hover:bg-surface"
                  data-activity-run
                >
                  <span className="flex items-center gap-2.5">
                    <span aria-hidden className="size-4 shrink-0 animate-spin rounded-full border-2 border-accent/30 border-t-accent motion-reduce:animate-none" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{run.products?.name ?? t.library.title}</span>
                      <span className="block text-xs text-muted">
                        {t.run[view.phase]} · {fmt(t.run.saved, { done: view.saved, total: view.total })}
                      </span>
                    </span>
                  </span>
                  <span className="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden>
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-accent to-violet transition-[width]"
                      style={{ width: `${Math.max(percent, 6)}%` }}
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted">{t.activity.nothingNow}</p>
      )}

      <h3 className={section}>{t.activity.comingUp}</h3>
      {posts?.length ? (
        <ul className="flex flex-col">
          {posts.map((post) => {
            const where = [...new Set(post.account_ids.map((id) => platformOf.get(id)).filter(Boolean))].join(", ");
            return (
              <li key={post.id}>
                <Link href="/dashboard/publishing" className="flex items-start gap-2.5 rounded-xl px-1 py-2 hover:bg-surface" data-activity-post>
                  <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {where && <>{where} · </>}
                      <LocalTime iso={post.scheduled_for} />
                    </span>
                    {post.caption && <span className="block truncate text-xs text-muted">{post.caption}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          {t.activity.noPosts}{" "}
          <Link href="/dashboard/publishing" className="font-medium text-accent hover:underline">{t.activity.planPosts}</Link>
        </p>
      )}

      <h3 className={section}>{t.activity.justFinished}</h3>
      {recent?.length ? (
        <>
          <ul className="grid grid-cols-3 gap-1.5">
            {recent.map((ad) => (
              <li key={ad.id}>
                <Link href="/dashboard/ads" className="block overflow-hidden rounded-xl bg-surface" data-activity-ad>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/creatives/${ad.id}/image?preview=1&layout=face-aware-v2`}
                    alt=""
                    loading="lazy"
                    className="aspect-square w-full object-cover transition hover:scale-105"
                  />
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/dashboard/ads" className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-accent hover:underline">
            {t.activity.seeAll} <span aria-hidden className="ms-1 rtl:rotate-180">→</span>
          </Link>
        </>
      ) : (
        <p className="text-sm text-muted">{t.activity.noAds}</p>
      )}
    </div>
  );
}
