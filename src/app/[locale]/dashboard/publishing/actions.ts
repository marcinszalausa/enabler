"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userMessage } from "@/lib/errors";
import { isPlatformKey } from "@/lib/social/platforms";
import { isTimeZone, parseSlots, type Slot } from "@/lib/social/schedule";
import {
  connectUrl,
  deleteAccount,
  deletePost,
  zernioConfigured,
} from "@/lib/social/zernio";
import {
  accountsInPlan,
  ensureProfile,
  publishCreatives,
  type When,
} from "@/lib/social/publish";
import { requestMessages } from "@/i18n/server";
import { fmt } from "@/i18n/format";

async function currentWorkspace() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  // RLS: only the caller's workspaces.
  const { data: ws } = await supabase
    .from("workspaces")
    .select("id, name")
    .order("created_at")
    .limit(1)
    .single();
  if (!ws) throw new Error("No workspace found.");
  return ws as { id: string; name: string };
}

// Sends the browser to the network's login, via Zernio, and back to
// /api/social/callback.
export async function connectAccount(formData: FormData) {
  const platform = formData.get("platform");
  if (!isPlatformKey(platform) || !zernioConfigured()) return;
  const ws = await currentWorkspace();
  const origin = (await headers()).get("origin") ?? "https://gooidy.com";
  const { total, limit } = await accountsInPlan(ws.id);
  if (total >= limit) redirect("/dashboard/publishing?error=limit");

  let authUrl: string;
  try {
    const profileId = await ensureProfile(ws.id, ws.name);
    authUrl = await connectUrl(
      platform,
      profileId,
      `${origin}/api/social/callback`,
    );
  } catch (err) {
    console.error("connect failed", platform, err);
    const detail = err instanceof Error ? err.message.slice(0, 200) : "";
    redirect(
      `/dashboard/publishing?error=connect&detail=${encodeURIComponent(detail)}`,
    );
  }
  redirect(authUrl);
}

export async function disconnectAccount(formData: FormData) {
  const accountId = String(formData.get("accountId") ?? "");
  const ws = await currentWorkspace();
  const db = createAdminClient();
  const { data: account } = await db
    .from("social_accounts")
    .select("id")
    .eq("id", accountId)
    .eq("workspace_id", ws.id)
    .maybeSingle();
  if (!account) return;
  try {
    await deleteAccount(account.id);
  } catch (err) {
    console.error("disconnect failed", account.id, err);
  }
  await db.from("social_accounts").delete().eq("id", account.id);
  revalidatePath("/dashboard/publishing");
}

export type ScheduleState = { error: string | null; saved: boolean };

export async function saveSchedule(
  _prev: ScheduleState,
  formData: FormData,
): Promise<ScheduleState> {
  const { publish: t } = await requestMessages();
  const ws = await currentWorkspace();
  const timeZone = formData.get("timeZone");
  if (!isTimeZone(timeZone)) return { error: t.errors.timeZone, saved: false };

  let slots: Slot[];
  try {
    slots = parseSlots(JSON.parse(String(formData.get("slots") ?? "[]")));
  } catch {
    slots = [];
  }
  const autopilot = formData.get("autopilot") === "on";
  const db = createAdminClient();
  const { data: accounts } = await db
    .from("social_accounts")
    .select("id")
    .eq("workspace_id", ws.id)
    .in("id", formData.getAll("autopilotAccounts").map(String));
  if (autopilot && slots.length === 0) {
    return { error: t.errors.noSchedule, saved: false };
  }
  if (autopilot && !accounts?.length) {
    return { error: t.errors.pickAccounts, saved: false };
  }

  const { error } = await db.from("publishing_schedules").upsert({
    workspace_id: ws.id,
    time_zone: timeZone,
    slots,
    autopilot,
    autopilot_accounts: (accounts ?? []).map((a) => a.id),
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error("schedule save failed", error);
    return { error: t.errors.couldnt, saved: false };
  }
  revalidatePath("/dashboard", "layout");
  return { error: null, saved: true };
}

export type PublishState = { error: string | null; done: string | null };

export async function publishAds(
  _prev: PublishState,
  formData: FormData,
): Promise<PublishState> {
  const { publish: t } = await requestMessages();
  const ws = await currentWorkspace();
  const creativeIds = formData.getAll("creativeIds").map(String);
  const accountIds = formData.getAll("accountIds").map(String);
  if (creativeIds.length === 0) return { error: t.errors.pickAds, done: null };
  if (accountIds.length === 0) {
    return { error: t.errors.pickAccounts, done: null };
  }

  const mode = formData.get("when");
  let when: When;
  if (mode === "at") {
    const local = String(formData.get("at") ?? "");
    const timeZone = formData.get("timeZone");
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(local) ||
      !isTimeZone(timeZone)
    ) {
      return { error: t.errors.pickTime, done: null };
    }
    when = { type: "at", local: `${local.slice(0, 16)}:00`, timeZone };
  } else {
    when = { type: mode === "queue" ? "queue" : "now" };
  }
  if (when.type === "queue") {
    const { data: schedule } = await createAdminClient()
      .from("publishing_schedules")
      .select("slots")
      .eq("workspace_id", ws.id)
      .maybeSingle();
    if (parseSlots(schedule?.slots).length === 0) {
      return { error: t.errors.noSchedule, done: null };
    }
  }

  // RLS: only ads in the caller's workspace come back.
  const supabase = await createClient();
  const { data: creatives } = await supabase
    .from("creatives")
    .select("id, generations(product_id)")
    .in("id", creativeIds)
    .eq("workspace_id", ws.id);
  if (!creatives?.length) return { error: t.errors.pickAds, done: null };

  try {
    const caption = String(formData.get("caption") ?? "");
    const { posted, skipped } = await publishCreatives({
      workspaceId: ws.id,
      creativeIds: creatives.map((c) => c.id),
      accountIds,
      when,
      caption: creatives.length === 1 ? caption : undefined,
    });
    for (const productId of new Set(
      creatives.map(
        (c) =>
          (c.generations as unknown as { product_id: string } | null)
            ?.product_id,
      ),
    )) {
      if (productId) revalidatePath(`/dashboard/products/${productId}`);
    }
    revalidatePath("/dashboard/publishing");
    if (posted === 0) return { error: t.errors.couldnt, done: null };
    const done = when.type === "now" ? t.doneNow : t.doneQueued;
    return {
      error: null,
      done:
        skipped > 0 ? `${done} ${fmt(t.skipped, { count: skipped })}` : done,
    };
  } catch (err) {
    return { error: userMessage(err, t.errors.couldnt), done: null };
  }
}

export async function cancelPost(formData: FormData) {
  const postId = String(formData.get("postId") ?? "");
  const ws = await currentWorkspace();
  const db = createAdminClient();
  const { data: post } = await db
    .from("posts")
    .select("id, zernio_post_id, status")
    .eq("id", postId)
    .eq("workspace_id", ws.id)
    .maybeSingle();
  if (!post || post.status !== "scheduled") return;
  try {
    if (post.zernio_post_id) await deletePost(post.zernio_post_id);
  } catch (err) {
    console.error("cancel failed", post.id, err);
    return;
  }
  await db
    .from("posts")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", post.id);
  revalidatePath("/dashboard", "layout");
}
