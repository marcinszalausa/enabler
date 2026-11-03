import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderAdImage } from "@/lib/ad-image";
import { UserError } from "@/lib/errors";
import {
  createPost,
  createProfile,
  getPost,
  listAccounts,
  uploadMedia,
  type NewPost,
  type ZernioPost,
} from "./zernio";
import { CAPTION_LIMITS, takesKind } from "./platforms";
import { accountLimit } from "./limits";
import { nextSlots, parseSlots, toLocal, fromLocal } from "./schedule";

type Db = ReturnType<typeof createAdminClient>;

// The workspace's Zernio profile, made on first use.
export async function ensureProfile(workspaceId: string, name: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("social_profiles")
    .select("zernio_profile_id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (data) return data.zernio_profile_id as string;

  const id = await createProfile(`${name} (${workspaceId.slice(0, 8)})`);
  const { error } = await db
    .from("social_profiles")
    .insert({ workspace_id: workspaceId, zernio_profile_id: id });
  if (error) {
    // Another tab made one at the same moment; use that.
    const { data: again } = await db
      .from("social_profiles")
      .select("zernio_profile_id")
      .eq("workspace_id", workspaceId)
      .single();
    if (again) return again.zernio_profile_id as string;
    throw error;
  }
  return id;
}

// Copies the accounts connected at Zernio into social_accounts, removing
// ones that were disconnected there.
export async function syncAccounts(workspaceId: string) {
  const db = createAdminClient();
  const { data: profile, error: profileError } = await db
    .from("social_profiles")
    .select("zernio_profile_id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) return;

  const accounts = await listAccounts(profile.zernio_profile_id);
  if (accounts.length > 0) {
    const { error: upsertError } = await db.from("social_accounts").upsert(
      accounts.map((a) => ({
        id: a._id,
        workspace_id: workspaceId,
        platform: a.platform,
        username: a.username ?? null,
        display_name: a.displayName ?? null,
        avatar_url: a.profilePicture ?? null,
      })),
    );
    if (upsertError) throw upsertError;
  }
  const keep = accounts.map((a) => a._id);
  let stale = db
    .from("social_accounts")
    .delete()
    .eq("workspace_id", workspaceId);
  if (keep.length > 0) stale = stale.not("id", "in", `(${keep.join(",")})`);
  const { error: staleError } = await stale;
  if (staleError) throw staleError;
}

// The workspace's accounts the plan covers: the earliest connected, up to
// its limit (after a downgrade the newest ones stop being used).
export async function accountsInPlan(workspaceId: string) {
  const db = createAdminClient();
  const [{ data: ws, error: workspaceError }, { data: accounts, error: accountsError }] = await Promise.all([
    db.from("workspaces").select("plan").eq("id", workspaceId).single(),
    db
      .from("social_accounts")
      .select("id")
      .eq("workspace_id", workspaceId)
      .order("created_at")
      .order("id"),
  ]);
  if (workspaceError) throw workspaceError;
  if (accountsError) throw accountsError;
  if (!ws) throw new Error("Workspace not found.");
  const limit = accountLimit(ws.plan);
  return {
    limit,
    total: accounts?.length ?? 0,
    ids: (accounts ?? []).slice(0, limit).map((a) => a.id as string),
  };
}

export type When =
  | { type: "now" }
  | { type: "queue" }
  | { type: "at"; local: string; timeZone: string };

type CreativeRow = {
  id: string;
  workspace_id: string;
  kind: "image" | "video";
  aspect: string;
  storage_path: string;
  headline: string | null;
  primary_text: string | null;
  cta: string | null;
  generations: { products: { url: string } | null } | null;
};

// Sends ads to the chosen accounts: now, at a time, or into the next free
// slots of the weekly schedule (one ad per slot). Returns how many posts
// were created and how many ads no chosen network takes.
export async function publishCreatives({
  workspaceId,
  creativeIds,
  accountIds,
  when,
  caption,
}: {
  workspaceId: string;
  creativeIds: string[];
  accountIds: string[];
  when: When;
  // Replaces the ad's own text; only when publishing a single ad.
  caption?: string;
}) {
  const db = createAdminClient();
  const [{ data: accounts }, { data: creatives }] = await Promise.all([
    db
      .from("social_accounts")
      .select("id, platform")
      .eq("workspace_id", workspaceId)
      .in("id", accountIds),
    db
      .from("creatives")
      .select(
        "id, workspace_id, kind, aspect, storage_path, headline, primary_text, cta, generations(products(url))",
      )
      .eq("workspace_id", workspaceId)
      .in("id", creativeIds)
      .returns<CreativeRow[]>(),
  ]);
  const { ids: covered } = await accountsInPlan(workspaceId);
  const allowed = (accounts ?? []).filter((a) => covered.includes(a.id));
  if (!allowed.length) throw new UserError("Pick at least one account.");
  if (!creatives?.length) throw new UserError("Pick at least one ad.");

  // Keep the order the customer saw them in.
  creatives.sort(
    (a, b) => creativeIds.indexOf(a.id) - creativeIds.indexOf(b.id),
  );
  const times = await scheduleTimes(db, workspaceId, when, creatives.length);

  let posted = 0;
  let skipped = 0;
  for (const [i, creative] of creatives.entries()) {
    const targets = allowed.filter((a) => takesKind(a.platform, creative.kind));
    if (targets.length === 0) {
      skipped++;
      continue;
    }
    const time = times[i];
    const text =
      caption?.trim() ||
      [creative.primary_text, creative.generations?.products?.url]
        .filter(Boolean)
        .join("\n\n");
    const media = await mediaFor(db, creative);
    const post: NewPost = {
      content: text,
      mediaItems: [{ type: creative.kind, url: media }],
      platforms: targets.map((a) => ({
        platform: a.platform,
        accountId: a.id,
        ...platformOptions(a.platform, creative, text),
      })),
      ...(time
        ? { scheduledFor: time.local, timezone: time.timeZone }
        : { publishNow: true }),
      ...(targets.some((a) => a.platform === "tiktok")
        ? {
            // The customer ticks TikTok's consent line before publishing.
            tiktokSettings: {
              privacy_level: "PUBLIC_TO_EVERYONE",
              allow_comment: true,
              allow_duet: true,
              allow_stitch: true,
              content_preview_confirmed: true,
              express_consent_given: true,
            },
          }
        : {}),
      metadata: { workspaceId, creativeId: creative.id },
    };

    const id = randomUUID();
    const { error: insertError } = await db.from("posts").insert({
      id,
      workspace_id: workspaceId,
      creative_id: creative.id,
      caption: text,
      account_ids: targets.map((a) => a.id),
      scheduled_for: time
        ? fromLocal(time.local, time.timeZone).toISOString()
        : null,
      status: time ? "scheduled" : "publishing",
    });
    if (insertError) throw insertError;

    try {
      const result = await createPost(post, id);
      await applyZernioPost(db, id, result);
      posted++;
    } catch (err) {
      console.error("publish failed", creative.id, err);
      await db
        .from("posts")
        .update({
          status: "failed",
          error: err instanceof Error ? err.message : "Publishing failed.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (creatives.length === 1) {
        throw new UserError(
          err instanceof Error ? err.message : "Publishing failed.",
        );
      }
    }
  }
  return { posted, skipped };
}

async function scheduleTimes(
  db: Db,
  workspaceId: string,
  when: When,
  count: number,
): Promise<({ local: string; timeZone: string } | null)[]> {
  if (when.type === "now") return Array(count).fill(null);
  if (when.type === "at") {
    if (fromLocal(when.local, when.timeZone).getTime() < Date.now() + 60_000) {
      throw new UserError("Pick a time in the future.");
    }
    return Array(count).fill({ local: when.local, timeZone: when.timeZone });
  }

  const { data: schedule } = await db
    .from("publishing_schedules")
    .select("time_zone, slots")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  const slots = parseSlots(schedule?.slots);
  if (!schedule || slots.length === 0) {
    throw new UserError("Set up your posting schedule first.");
  }
  const timeZone = schedule.time_zone as string;

  const { data: upcoming } = await db
    .from("posts")
    .select("scheduled_for")
    .eq("workspace_id", workspaceId)
    .eq("status", "scheduled")
    .gt("scheduled_for", new Date().toISOString());
  const taken = new Set(
    (upcoming ?? []).map((p) => toLocal(new Date(p.scheduled_for), timeZone)),
  );
  return nextSlots(slots, timeZone, taken, count).map((local) => ({
    local,
    timeZone,
  }));
}

// Uploads the finished ad (image with its text, or the edited video).
async function mediaFor(db: Db, creative: CreativeRow) {
  const name = `gooidy-${creative.id.slice(0, 8)}`;
  if (creative.kind === "video") {
    const { data, error } = await db.storage
      .from("creatives")
      .download(creative.storage_path);
    if (error || !data) throw new UserError("The video file is missing.");
    return uploadMedia(await data.arrayBuffer(), "video/mp4", `${name}.mp4`);
  }
  const image = await renderAdImage(db, creative);
  if (!image) throw new UserError("The ad image is missing.");
  return uploadMedia(await image.arrayBuffer(), "image/png", `${name}.png`);
}

function platformOptions(
  platform: string,
  creative: CreativeRow,
  text: string,
): Pick<
  NewPost["platforms"][number],
  "customContent" | "platformSpecificData"
> {
  const url = creative.generations?.products?.url;
  const title = (creative.headline ?? "").slice(0, 100);
  const limit = CAPTION_LIMITS[platform];
  const customContent =
    limit && text.length > limit ? shorten(text, url, limit) : undefined;
  const vertical = creative.aspect === "9:16";

  switch (platform) {
    case "instagram":
      // Instagram's feed doesn't take 9:16 photos; they go to Stories.
      return creative.kind === "image" && vertical
        ? { platformSpecificData: { contentType: "story" } }
        : {};
    case "youtube":
      return {
        platformSpecificData: { title: title || "New", visibility: "public" },
      };
    case "pinterest":
      return {
        customContent,
        platformSpecificData: { title, ...(url ? { link: url } : {}) },
      };
    default:
      return customContent ? { customContent } : {};
  }
}

// Fits the ad text under a network's limit, keeping the product link.
function shorten(text: string, url: string | undefined, limit: number) {
  const tail = url ? `\n\n${url}` : "";
  const body = url ? text.replace(tail, "") : text;
  const room = limit - tail.length - 1;
  return `${body.slice(0, Math.max(0, room)).trimEnd()}…${tail}`;
}

const STATUSES = new Set([
  "scheduled",
  "publishing",
  "published",
  "partial",
  "failed",
  "cancelled",
]);

// Stores what Zernio says about a post: overall and per network.
export async function applyZernioPost(db: Db, postId: string, z: ZernioPost) {
  const results = (z.platforms ?? []).map((p) => ({
    platform: p.platform,
    account_id:
      typeof p.accountId === "string"
        ? p.accountId
        : (p.accountId?._id ?? null),
    status: p.status ?? null,
    url: p.publishedUrl ?? p.platformPostUrl ?? null,
    error: p.error ?? p.errorMessage ?? null,
  }));
  const status = STATUSES.has(z.status)
    ? z.status
    : z.status === "draft" || z.status === "pending"
      ? "scheduled"
      : "publishing";
  await db
    .from("posts")
    .update({
      zernio_post_id: z._id ?? z.id ?? undefined,
      status,
      results,
      error: results.find((r) => r.error)?.error ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);
}

// Asks Zernio about posts that should have gone out by now, for when the
// webhook isn't set up or a delivery was missed.
export async function refreshDuePosts(workspaceId: string) {
  const db = createAdminClient();
  const { data: due } = await db
    .from("posts")
    .select("id, zernio_post_id")
    .eq("workspace_id", workspaceId)
    .in("status", ["scheduled", "publishing"])
    .not("zernio_post_id", "is", null)
    .or(`scheduled_for.is.null,scheduled_for.lt.${new Date().toISOString()}`)
    .limit(10);
  await Promise.all(
    (due ?? []).map(async (p) => {
      try {
        await applyZernioPost(db, p.id, await getPost(p.zernio_post_id));
      } catch (err) {
        console.error("post refresh failed", p.id, err);
      }
    }),
  );
}

// Autopilot: when a run finishes, its ads go into the next free slots on the
// accounts the customer picked. Feed images and videos only, so a run of
// ten images (each in two sizes) becomes five posts, not ten.
export async function autopilotRun(workspaceId: string, generationId: string) {
  if (!process.env.ZERNIO_API_KEY) return;
  try {
    const db = createAdminClient();
    const { data: schedule } = await db
      .from("publishing_schedules")
      .select("autopilot, autopilot_accounts")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!schedule?.autopilot || !schedule.autopilot_accounts?.length) return;

    const { data: creatives } = await db
      .from("creatives")
      .select("id, kind, aspect")
      .eq("generation_id", generationId)
      .order("created_at");
    const ids = (creatives ?? [])
      .filter((c) => c.kind === "video" || c.aspect === "1:1")
      .map((c) => c.id);
    if (ids.length === 0) return;

    await publishCreatives({
      workspaceId,
      creativeIds: ids,
      accountIds: schedule.autopilot_accounts,
      when: { type: "queue" },
    });
  } catch (err) {
    // The run itself succeeded; a publishing problem shows on the posts.
    console.error("autopilot failed", generationId, err);
  }
}
