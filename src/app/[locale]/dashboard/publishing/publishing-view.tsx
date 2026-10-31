import Link from "next/link";
import type { Messages } from "@/i18n/messages";
import { fmt } from "@/i18n/format";
import { smallButton } from "../ui";
import { PLATFORMS, platformName } from "@/lib/social/platforms";
import {
  DEFAULT_SLOTS,
  formatLocal,
  parseSlots,
  toLocal,
} from "@/lib/social/schedule";
import { cancelPost, connectAccount, disconnectAccount } from "./actions";
import { ScheduleForm } from "./schedule-form";

// The Publishing page itself: accounts, schedule and posts.

const card = "edge flex flex-col gap-4 p-6";

export type AccountRow = {
  id: string;
  platform: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type ScheduleRow = {
  time_zone: string;
  slots: unknown;
  autopilot: boolean;
  autopilot_accounts: string[];
};

export function PublishingView({
  t,
  locale,
  accounts,
  schedule,
  posts,
  connected,
  failed,
  detail,
  overLimit,
  limit,
}: {
  t: Messages;
  locale: string;
  accounts: AccountRow[];
  schedule: ScheduleRow | null;
  posts: PostRow[];
  connected: string | null;
  failed: boolean;
  // What the network or Zernio said, shown under the error.
  detail: string | null;
  overLimit: boolean;
  // Accounts the plan covers; the earliest connected count first.
  limit: number;
}) {
  const full = accounts.length >= limit;
  const timeZone = schedule?.time_zone ?? null;
  const upcoming = (posts ?? [])
    .filter((p) => p.status === "scheduled")
    .sort((a, b) =>
      (a.scheduled_for ?? "").localeCompare(b.scheduled_for ?? ""),
    );
  const recent = (posts ?? []).filter((p) => p.status !== "scheduled");
  const when = (iso: string) =>
    timeZone
      ? formatLocal(toLocal(new Date(iso), timeZone), locale)
      : new Date(iso).toLocaleString(locale, {
          dateStyle: "medium",
          timeStyle: "short",
        });

  return (
    <div className="mt-8 flex flex-col gap-8">
      {connected && (
        <p
          role="status"
          className="rounded-xl bg-ok-bg px-4 py-3 text-sm text-ok"
        >
          {fmt(t.publish.connected, { platform: platformName(connected) })}
        </p>
      )}
      {failed && (
        <p
          role="alert"
          className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger"
        >
          {t.publish.connectFailed}
          {detail && (
            <span className="mt-1 block text-xs opacity-80">{detail}</span>
          )}
        </p>
      )}
      {overLimit && (
        <p
          role="alert"
          className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger"
        >
          {t.publish.limitReached}{" "}
          <Link href="/#pricing" className="font-medium underline">
            {t.publish.upgrade}
          </Link>
        </p>
      )}

      <section className={card}>
        <div>
          <h2 className="text-lg font-semibold">{t.publish.accounts}</h2>
          <p className="mt-0.5 text-sm text-muted">{t.publish.accountsHelp}</p>
          <p className="mt-2 text-sm">
            <span className={full ? "font-medium text-accent" : "text-muted"}>
              {fmt(t.publish.accountsUsed, {
                used: Math.min(accounts.length, limit),
                limit,
              })}
            </span>
            {full && (
              <>
                {" · "}
                <Link
                  href="/#pricing"
                  className="font-medium text-accent underline underline-offset-4"
                >
                  {t.publish.upgradeMore}
                </Link>
              </>
            )}
          </p>
        </div>
        {accounts?.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {accounts.map((a, i) => (
              <li
                key={a.id}
                className={`flex items-center gap-3 rounded-xl border border-line bg-surface/50 px-3 py-2 ${
                  i >= limit ? "opacity-50" : ""
                }`}
                title={i >= limit ? t.publish.notInPlan : undefined}
              >
                {a.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- the network's own profile picture
                  <img
                    src={a.avatar_url}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                    {platformName(a.platform).slice(0, 1)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {a.display_name ?? a.username ?? platformName(a.platform)}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {platformName(a.platform)}
                    {a.username ? ` · @${a.username.replace(/^@/, "")}` : ""}
                  </p>
                </div>
                <form action={disconnectAccount}>
                  <input type="hidden" name="accountId" value={a.id} />
                  <button className="text-xs text-muted underline-offset-4 hover:text-danger hover:underline">
                    {t.publish.disconnect}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t.publish.noAccounts}</p>
        )}
        <div>
          <p className="mb-2 text-sm font-medium">{t.publish.connectMore}</p>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <form key={p.key} action={connectAccount}>
                <input type="hidden" name="platform" value={p.key} />
                <button
                  disabled={full}
                  className={`${smallButton} disabled:pointer-events-none disabled:opacity-40`}
                  title={
                    p.video && !p.image
                      ? t.publish.videosOnly
                      : p.image && !p.video
                        ? t.publish.imagesOnly
                        : undefined
                  }
                >
                  <span aria-hidden>+</span> {p.name}
                </button>
              </form>
            ))}
          </div>
        </div>
      </section>

      <section id="schedule" className={card}>
        <div>
          <h2 className="text-lg font-semibold">{t.publish.schedule}</h2>
          <p className="mt-0.5 text-sm text-muted">{t.publish.scheduleHelp}</p>
        </div>
        <ScheduleForm
          key={JSON.stringify(schedule)}
          timeZone={timeZone}
          slots={schedule ? parseSlots(schedule.slots) : DEFAULT_SLOTS}
          autopilot={schedule?.autopilot ?? false}
          autopilotAccounts={
            schedule?.autopilot_accounts ?? (accounts ?? []).map((a) => a.id)
          }
          accounts={(accounts ?? []).map((a) => ({
            id: a.id,
            label: `${platformName(a.platform)} · ${a.display_name ?? a.username ?? ""}`,
          }))}
        />
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold">{t.publish.posts}</h2>
        {(posts ?? []).length === 0 ? (
          <p className="text-sm text-muted">{t.publish.noPosts}</p>
        ) : (
          <>
            {upcoming.length > 0 && (
              <PostList
                t={t}
                title={t.publish.upcoming}
                posts={upcoming}
                when={when}
              />
            )}
            {recent.length > 0 && (
              <PostList
                t={t}
                title={t.publish.recent}
                posts={recent}
                when={when}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}

export type PostRow = {
  id: string;
  creative_id: string | null;
  caption: string | null;
  status: keyof Messages["publish"]["status"];
  scheduled_for: string | null;
  results: {
    platform: string;
    status: string | null;
    url: string | null;
    error: string | null;
  }[];
  error: string | null;
  created_at: string;
  creatives: { kind: string; aspect: string } | null;
};

function PostList({
  t,
  title,
  posts,
  when,
}: {
  t: Messages;
  title: string;
  posts: PostRow[];
  when: (iso: string) => string;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-muted">{title}</h3>
      <ul className="flex flex-col divide-y divide-line">
        {posts.map((p) => (
          <li key={p.id} className="flex gap-3 py-3">
            {p.creative_id &&
              (p.creatives?.kind === "video" ? (
                <video
                  src={`/api/creatives/${p.creative_id}/video`}
                  muted
                  playsInline
                  preload="metadata"
                  className="h-16 w-12 shrink-0 rounded-md bg-surface object-cover"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- rendered on demand by our own route
                <img
                  src={`/api/creatives/${p.creative_id}/image`}
                  alt=""
                  loading="lazy"
                  className="h-16 w-12 shrink-0 rounded-md bg-surface object-cover"
                />
              ))}
            <div className="min-w-0 flex-1 text-sm">
              <p>
                <span
                  className={`font-medium ${
                    p.status === "published"
                      ? "text-ok"
                      : p.status === "failed" || p.status === "partial"
                        ? "text-danger"
                        : p.status === "cancelled"
                          ? "text-muted"
                          : "text-accent"
                  }`}
                >
                  {t.publish.status[p.status]}
                </span>
                <span className="text-muted">
                  {" · "}
                  {when(p.scheduled_for ?? p.created_at)}
                </span>
              </p>
              <p className="mt-0.5 line-clamp-1 text-muted">{p.caption}</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {p.results.map((r, i) => (
                  <span key={i} className={r.error ? "text-danger" : ""}>
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-4 hover:text-accent"
                      >
                        {platformName(r.platform)} ↗
                      </a>
                    ) : (
                      platformName(r.platform)
                    )}
                    {r.error && `: ${r.error}`}
                  </span>
                ))}
                {p.results.length === 0 && p.error && (
                  <span className="text-danger">{p.error}</span>
                )}
              </div>
            </div>
            {p.status === "scheduled" && (
              <form action={cancelPost} className="shrink-0">
                <input type="hidden" name="postId" value={p.id} />
                <button className="text-xs text-muted underline-offset-4 hover:text-danger hover:underline">
                  {t.publish.cancel}
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
