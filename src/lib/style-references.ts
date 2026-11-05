import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPublicUrl } from "@/lib/public-fetch";
import { generateLibraryImage } from "@/lib/ai/fal";
import { STYLE_LIBRARY, libraryPath, libraryPrompt } from "@/lib/style-library";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The picker's form value: a style reference id, or nothing.
export function parseStyleField(value: unknown): string | null {
  return typeof value === "string" && UUID.test(value) ? value : null;
}

// True when the caller may use this reference: Gooidy's library or one of
// its workspace's uploads. Uses the caller's (RLS) client.
export async function canUseStyle(client: SupabaseClient, workspaceId: string, id: string) {
  const { data } = await client.from("style_references").select("workspace_id").eq("id", id).maybeSingle();
  return Boolean(data) && (data!.workspace_id === null || data!.workspace_id === workspaceId);
}

// The run's style reference as a URL the image models can fetch, with its
// written description. Null when the run has none or it was removed since.
export async function runStyle(db: SupabaseClient, generationId: string, workspaceId: string) {
  const { data: run } = await db.from("generations").select("request_options")
    .eq("id", generationId).eq("workspace_id", workspaceId).maybeSingle();
  const id = parseStyleField(((run?.request_options as Record<string, unknown> | null)?.style_reference as { id?: unknown } | undefined)?.id);
  if (!id) return null;
  const { data: row } = await db.from("style_references").select("workspace_id, style, storage_path").eq("id", id).maybeSingle();
  if (!row || (row.workspace_id !== null && row.workspace_id !== workspaceId)) return null;
  const { data: signed } = await db.storage.from("creatives").createSignedUrl(row.storage_path as string, 6 * 3600);
  return signed?.signedUrl ? { url: signed.signedUrl, style: (row.style as string | null) ?? null } : null;
}

// How much of the library exists.
export async function libraryStatus() {
  const { count } = await createAdminClient().from("style_references").select("id", { count: "exact", head: true }).is("workspace_id", null);
  return { made: count ?? 0, total: STYLE_LIBRARY.length };
}

// Draws every library image that's still missing, three at a time. Safe to
// run again: finished images are skipped, failed ones are tried next time.
// At most `limit` per call, so one click fits in a request.
export async function buildStyleLibrary(limit = 15) {
  const db = createAdminClient();
  const { data } = await db.from("style_references").select("slug").is("workspace_id", null);
  const done = new Set((data ?? []).map((r) => r.slug as string));
  const todo = STYLE_LIBRARY.filter((item) => !done.has(item.slug)).slice(0, limit);
  let made = 0;
  for (let i = 0; i < todo.length; i += 3) {
    await Promise.all(todo.slice(i, i + 3).map(async (item) => {
      try {
        const url = await generateLibraryImage(libraryPrompt(item));
        const image = await fetchPublicUrl(url, { maxBytes: 15 * 1024 * 1024, timeoutMs: 60000, accept: "image/*" });
        if (image.status < 200 || image.status >= 300) throw new Error(`Image download returned ${image.status}.`);
        const path = libraryPath(item.slug);
        const stored = await db.storage.from("creatives").upload(path, new Uint8Array(image.body), { contentType: image.contentType || "image/jpeg", upsert: true });
        if (stored.error) throw stored.error;
        const { error } = await db.from("style_references").upsert(
          { slug: item.slug, category: item.category, style: item.style, storage_path: path },
          { onConflict: "slug" },
        );
        if (error) throw error;
        made++;
      } catch (err) {
        console.error("style library image failed", item.slug, err);
      }
    }));
  }
  return { made, failed: todo.length - made };
}
