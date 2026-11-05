"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canEditWorkspace } from "@/lib/workspace-access";
import { requestMessages } from "@/i18n/server";
import { UPLOAD_MAX_BYTES } from "@/lib/source-image";
import { normalizeUpload } from "@/lib/upload-image";
import { STYLE_CATEGORIES, STYLE_LIBRARY, type StyleCategory } from "@/lib/style-library";

export type StyleItem = { id: string; src: string; category: StyleCategory | "yours" };

const ORDER = new Map(STYLE_LIBRARY.map((s, i) => [s.slug, i]));

// Gooidy's style library plus the references this workspace uploaded.
export async function listStyles(): Promise<StyleItem[]> {
  const supabase = await createClient();
  const { data: rows } = await supabase.from("style_references")
    .select("id, workspace_id, slug, category, storage_path, created_at")
    .order("created_at", { ascending: false }).limit(300);
  const list = rows ?? [];
  if (!list.length) return [];
  // Library files sit outside any workspace folder, so the server signs them.
  const { data: signed } = await createAdminClient().storage.from("creatives")
    .createSignedUrls(list.map((r) => r.storage_path as string), 3600);
  const url = new Map((signed ?? []).flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
  const yours = list.filter((r) => r.workspace_id !== null);
  const library = list.filter((r) => r.workspace_id === null && STYLE_CATEGORIES.includes(r.category as StyleCategory))
    .sort((a, b) => (ORDER.get(a.slug as string) ?? 99) - (ORDER.get(b.slug as string) ?? 99));
  return [...yours, ...library].flatMap((r) => {
    const src = url.get(r.storage_path as string);
    return src ? [{ id: r.id as string, src, category: r.workspace_id === null ? (r.category as StyleCategory) : "yours" }] : [];
  });
}

export type StyleUpload = { error: string } | { style: StyleItem };

// Saves a reference photo the owner likes the look of, for this workspace.
export async function uploadStyle(form: FormData): Promise<StyleUpload> {
  const t = (await requestMessages()).picker;
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: t.uploadFailed };
  if (file.size > UPLOAD_MAX_BYTES) return { error: t.tooBig };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: t.uploadFailed };
  const { data: ws } = await supabase.from("workspaces").select("id").order("created_at").limit(1).single();
  if (!ws || !(await canEditWorkspace(supabase, ws.id as string))) return { error: t.uploadFailed };

  let image: Awaited<ReturnType<typeof normalizeUpload>>;
  try {
    image = await normalizeUpload(file);
  } catch {
    return { error: t.badType };
  }
  if (Math.min(image.width, image.height) < 256) return { error: t.tooSmall };

  const admin = createAdminClient();
  const path = `${ws.id}/styles/${crypto.randomUUID()}.jpg`;
  const stored = await admin.storage.from("creatives").upload(path, new Uint8Array(image.jpeg), { contentType: "image/jpeg" });
  if (stored.error) {
    console.error("style upload failed", stored.error.message);
    return { error: t.uploadFailed };
  }
  const { data: row, error } = await admin.from("style_references")
    .insert({ workspace_id: ws.id, category: "upload", storage_path: path, created_by: auth.user.id })
    .select("id").single();
  if (error || !row) {
    await admin.storage.from("creatives").remove([path]);
    console.error("style upload row failed", error?.message);
    return { error: t.uploadFailed };
  }
  const { data: signed } = await admin.storage.from("creatives").createSignedUrl(path, 3600);
  return { style: { id: row.id as string, src: signed?.signedUrl ?? "", category: "yours" } };
}
