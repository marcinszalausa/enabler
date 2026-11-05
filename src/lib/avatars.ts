import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPublicUrl } from "@/lib/public-fetch";
import { generateLibraryImage } from "@/lib/ai/fal";
import { AVATAR_LIBRARY, avatarLibraryPath, avatarLibraryPrompt } from "@/lib/avatar-library";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The picker's form value: an avatar id, or nothing.
export function parseAvatarField(value: unknown): string | null {
  return typeof value === "string" && UUID.test(value) ? value : null;
}

// True when the caller may use this avatar: Gooidy's library or one its
// workspace created. Uses the caller's (RLS) client.
export async function canUseAvatar(client: SupabaseClient, workspaceId: string, id: string) {
  const { data } = await client.from("avatars").select("workspace_id").eq("id", id).maybeSingle();
  return Boolean(data) && (data!.workspace_id === null || data!.workspace_id === workspaceId);
}

// The run's avatar as a URL the image models can fetch, with its written
// description. Null when the run has none or it was removed since.
export async function runAvatar(db: SupabaseClient, generationId: string, workspaceId: string) {
  const { data: run } = await db.from("generations").select("request_options")
    .eq("id", generationId).eq("workspace_id", workspaceId).maybeSingle();
  const id = parseAvatarField(((run?.request_options as Record<string, unknown> | null)?.avatar as { id?: unknown } | undefined)?.id);
  if (!id) return null;
  const { data: row } = await db.from("avatars").select("workspace_id, description, storage_path").eq("id", id).maybeSingle();
  if (!row || (row.workspace_id !== null && row.workspace_id !== workspaceId)) return null;
  const { data: signed } = await db.storage.from("creatives").createSignedUrl(row.storage_path as string, 6 * 3600);
  return signed?.signedUrl ? { url: signed.signedUrl, description: (row.description as string | null) ?? null } : null;
}

// How much of the avatar library exists.
export async function avatarLibraryStatus() {
  const { count } = await createAdminClient().from("avatars").select("id", { count: "exact", head: true }).is("workspace_id", null);
  return { made: count ?? 0, total: AVATAR_LIBRARY.length };
}

// Draws every library avatar that's still missing, three at a time. Safe to
// run again: finished ones are skipped, failed ones are tried next time.
export async function buildAvatarLibrary(limit = 16) {
  const db = createAdminClient();
  const { data } = await db.from("avatars").select("slug").is("workspace_id", null);
  const done = new Set((data ?? []).map((r) => r.slug as string));
  const todo = AVATAR_LIBRARY.filter((item) => !done.has(item.slug)).slice(0, limit);
  let made = 0;
  for (let i = 0; i < todo.length; i += 3) {
    await Promise.all(todo.slice(i, i + 3).map(async (item) => {
      try {
        const url = await generateLibraryImage(avatarLibraryPrompt(item));
        const image = await fetchPublicUrl(url, { maxBytes: 15 * 1024 * 1024, timeoutMs: 60000, accept: "image/*" });
        if (image.status < 200 || image.status >= 300) throw new Error(`Image download returned ${image.status}.`);
        const path = avatarLibraryPath(item.slug);
        const stored = await db.storage.from("creatives").upload(path, new Uint8Array(image.body), { contentType: image.contentType || "image/jpeg", upsert: true });
        if (stored.error) throw stored.error;
        const { error } = await db.from("avatars").upsert(
          { slug: item.slug, name: item.name, gender: item.gender, age: item.age, look: item.look, description: item.description, storage_path: path },
          { onConflict: "slug" },
        );
        if (error) throw error;
        made++;
      } catch (err) {
        console.error("avatar library image failed", item.slug, err);
      }
    }));
  }
  return { made, failed: todo.length - made };
}
