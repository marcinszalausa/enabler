import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getMessages, type Messages } from "@/i18n/messages";
import { BackLink, EmptyState } from "../ui";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { zernioConfigured } from "@/lib/social/zernio";
import { accountLimit } from "@/lib/social/limits";
import { refreshDuePosts } from "@/lib/social/publish";
import {
  PublishingView,
  type AccountRow,
  type PostRow,
  type ScheduleRow,
} from "./publishing-view";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/dashboard/publishing">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: (await getMessages(locale)).publish.metaTitle };
}

export default async function PublishingPage({
  params,
  searchParams,
}: PageProps<"/[locale]/dashboard/publishing">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getMessages(locale);
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <BackLink href="/dashboard">{t.app.dashboard}</BackLink>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">
        {t.publish.title}
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">{t.publish.intro}</p>
      <Suspense
        fallback={<p className="mt-6 text-sm text-muted">{t.app.loading}</p>}
      >
        <Publishing t={t} locale={locale} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Publishing({
  t,
  locale,
  searchParams,
}: {
  t: Messages;
  locale: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await getCurrentUser();
  if (!zernioConfigured()) {
    return (
      <div className="mt-8">
        <EmptyState title={t.publish.title}>{t.publish.notReady}</EmptyState>
      </div>
    );
  }
  const supabase = await createClient();
  const { data: ws } = await supabase
    .from("workspaces")
    .select("id, plan")
    .order("created_at")
    .limit(1)
    .single();
  if (!ws) return null;
  await refreshDuePosts(ws.id);

  const [{ data: accounts }, { data: schedule }, { data: posts }, query] =
    await Promise.all([
      supabase
        .from("social_accounts")
        .select("id, platform, username, display_name, avatar_url")
        .eq("workspace_id", ws.id)
        .order("created_at"),
      supabase
        .from("publishing_schedules")
        .select("time_zone, slots, autopilot, autopilot_accounts")
        .eq("workspace_id", ws.id)
        .maybeSingle(),
      supabase
        .from("posts")
        .select(
          "id, creative_id, caption, status, scheduled_for, results, error, created_at, creatives(kind, aspect)",
        )
        .eq("workspace_id", ws.id)
        .order("created_at", { ascending: false })
        .limit(40),
      searchParams,
    ]);

  return (
    <PublishingView
      t={t}
      locale={locale}
      accounts={(accounts ?? []) as AccountRow[]}
      schedule={schedule as ScheduleRow | null}
      posts={(posts ?? []) as unknown as PostRow[]}
      connected={typeof query.connected === "string" ? query.connected : null}
      failed={query.error === "connect"}
      detail={typeof query.detail === "string" ? query.detail : null}
      overLimit={query.error === "limit"}
      limit={accountLimit(ws.plan)}
    />
  );
}
