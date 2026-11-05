import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// The photo a run starts from: one of the store's own product photos, or a
// photo the owner uploaded. Saved on the run as request_options.source_image.
export type SourceImage =
  | { kind: "product"; url: string }
  | { kind: "upload"; path: string };

export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
// Uploads are stored at this size; models don't use more.
export const UPLOAD_MAX_SIDE = 2048;

export function uploadFolder(workspaceId: string, productId: string) {
  return `${workspaceId}/uploads/${productId}`;
}

// Reads the picker's form value: "product:<url>" or "upload:<path>".
export function parseSourceField(value: unknown): SourceImage | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  if (value.startsWith("product:")) {
    const url = value.slice(8);
    return /^https?:\/\//.test(url) ? { kind: "product", url } : null;
  }
  if (value.startsWith("upload:")) {
    const path = value.slice(7);
    return /^[0-9a-f-]{36}\/uploads\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/.test(path) ? { kind: "upload", path } : null;
  }
  return null;
}

export function parseSourceImage(value: unknown): SourceImage | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.kind === "product" && typeof v.url === "string") return parseSourceField(`product:${v.url}`);
  if (v.kind === "upload" && typeof v.path === "string") return parseSourceField(`upload:${v.path}`);
  return null;
}

// True when the photo belongs to this workspace: a product photo of one of
// its products, or one of its uploads. Uses the caller's (RLS) client.
export async function ownsSourceImage(client: SupabaseClient, workspaceId: string, source: SourceImage) {
  if (source.kind === "upload") {
    if (!source.path.startsWith(workspaceId + "/")) return false;
    const { data } = await client.from("media_uploads").select("id")
      .eq("workspace_id", workspaceId).eq("storage_path", source.path).maybeSingle();
    return Boolean(data);
  }
  const { data } = await client.from("products").select("image_urls").eq("workspace_id", workspaceId);
  return (data ?? []).some((p) => ((p.image_urls as string[] | null) ?? []).includes(source.url));
}

// A URL the image and video models can fetch. Falls back to the product's
// first photo when the run has no choice (older runs) or the upload is gone.
export async function sourceImageUrl(
  db: SupabaseClient,
  workspaceId: string,
  source: SourceImage | null,
  fallback: string | null,
): Promise<string | null> {
  if (!source) return fallback;
  if (source.kind === "product") return source.url;
  if (!source.path.startsWith(workspaceId + "/")) return fallback;
  const { data } = await db.storage.from("creatives").createSignedUrl(source.path, 6 * 3600);
  return data?.signedUrl ?? fallback;
}

// The run's chosen photo, read from its saved options.
export async function runSourceImage(db: SupabaseClient, generationId: string, workspaceId: string) {
  const { data } = await db.from("generations").select("request_options")
    .eq("id", generationId).eq("workspace_id", workspaceId).maybeSingle();
  return parseSourceImage((data?.request_options as Record<string, unknown> | null)?.source_image);
}
