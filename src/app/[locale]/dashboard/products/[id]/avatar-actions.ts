"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canEditWorkspace } from "@/lib/workspace-access";
import { requestMessages } from "@/i18n/server";
import { UPLOAD_MAX_BYTES } from "@/lib/source-image";
import { normalizeUpload } from "@/lib/upload-image";
import { fetchPublicUrl } from "@/lib/public-fetch";
import { generateLibraryImage } from "@/lib/ai/fal";
import {
  AVATAR_AGES, AVATAR_CREDITS, AVATAR_DESCRIPTION_MAX, AVATAR_GENDERS, AVATAR_LIBRARY, AVATAR_LOOKS, AVATAR_NAME_MAX,
  customAvatarDescription, customAvatarPrompt, type AvatarAge, type AvatarGender, type AvatarLook,
} from "@/lib/avatar-library";

export type AvatarItem = {
  id: string; src: string; name: string; gender: AvatarGender; age: AvatarAge; look: AvatarLook; yours: boolean;
};

const ORDER = new Map(AVATAR_LIBRARY.map((s, i) => [s.slug, i]));

// Gooidy's avatar library plus the avatars this workspace created.
export async function listAvatars(): Promise<AvatarItem[]> {
  const supabase = await createClient();
  const { data: rows } = await supabase.from("avatars")
    .select("id, workspace_id, slug, name, gender, age, look, storage_path, created_at")
    .order("created_at", { ascending: false }).limit(300);
  const list = rows ?? [];
  if (!list.length) return [];
  // Library files sit outside any workspace folder, so the server signs them.
  const { data: signed } = await createAdminClient().storage.from("creatives")
    .createSignedUrls(list.map((r) => r.storage_path as string), 3600);
  const url = new Map((signed ?? []).flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
  const yours = list.filter((r) => r.workspace_id !== null);
  const library = list.filter((r) => r.workspace_id === null)
    .sort((a, b) => (ORDER.get(a.slug as string) ?? 99) - (ORDER.get(b.slug as string) ?? 99));
  return [...yours, ...library].flatMap((r) => {
    const src = url.get(r.storage_path as string);
    return src ? [{
      id: r.id as string, src, name: r.name as string, gender: r.gender as AvatarGender, age: r.age as AvatarAge,
      look: r.look as AvatarLook, yours: r.workspace_id !== null,
    }] : [];
  });
}

export type AvatarCreation = { error: string } | { avatar: AvatarItem; credits: number };

const pick = <T extends string>(list: readonly T[], value: FormDataEntryValue | null): T | null =>
  typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : null;

// Draws a new avatar for this workspace and charges for it. With a photo,
// the avatar follows that person, which needs their consent; the photo is
// only used for drawing and deleted right after.
export async function createAvatar(form: FormData): Promise<AvatarCreation> {
  const m = await requestMessages();
  const t = m.avatars;
  const name = String(form.get("name") ?? "").replace(/\s+/g, " ").trim().slice(0, AVATAR_NAME_MAX);
  const gender = pick(AVATAR_GENDERS, form.get("gender"));
  const age = pick(AVATAR_AGES, form.get("age"));
  const look = pick(AVATAR_LOOKS, form.get("look"));
  const details = String(form.get("details") ?? "").slice(0, AVATAR_DESCRIPTION_MAX);
  const file = form.get("photo");
  const photo = file instanceof File && file.size > 0 ? file : null;
  if (!name) return { error: t.nameRequired };
  if (!gender || !age || !look) return { error: t.createFailed };
  if (photo && form.get("consent") !== "on") return { error: t.consentRequired };
  if (photo && photo.size > UPLOAD_MAX_BYTES) return { error: m.picker.tooBig };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: t.createFailed };
  const { data: ws } = await supabase.from("workspaces").select("id").order("created_at").limit(1).single();
  if (!ws || !(await canEditWorkspace(supabase, ws.id as string))) return { error: t.createFailed };
  const workspaceId = ws.id as string;

  let photoJpeg: Buffer | null = null;
  if (photo) {
    try {
      const image = await normalizeUpload(photo);
      if (Math.min(image.width, image.height) < 256) return { error: m.picker.tooSmall };
      photoJpeg = image.jpeg;
    } catch {
      return { error: m.picker.badType };
    }
  }

  const admin = createAdminClient();
  const { data: charged, error: chargeError } = await admin.rpc("spend_credits", { ws: workspaceId, amount: AVATAR_CREDITS });
  if (chargeError) {
    console.error("avatar charge failed", chargeError.message);
    return { error: t.createFailed };
  }
  if (!charged) return { error: t.notEnough };

  const storage = admin.storage.from("creatives");
  const refPath = photoJpeg ? `${workspaceId}/avatars/source-${crypto.randomUUID()}.jpg` : null;
  const path = `${workspaceId}/avatars/${crypto.randomUUID()}.jpg`;
  try {
    let referenceImageUrl: string | null = null;
    if (refPath && photoJpeg) {
      const up = await storage.upload(refPath, new Uint8Array(photoJpeg), { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const { data: signed, error } = await storage.createSignedUrl(refPath, 600);
      if (error || !signed) throw error ?? new Error("Could not sign the photo.");
      referenceImageUrl = signed.signedUrl;
    }
    const description = customAvatarDescription({ gender, age, look, details });
    const url = await generateLibraryImage(customAvatarPrompt(description, Boolean(referenceImageUrl)), { quality: "best", referenceImageUrl });
    const image = await fetchPublicUrl(url, { maxBytes: 15 * 1024 * 1024, timeoutMs: 60000, accept: "image/*" });
    if (image.status < 200 || image.status >= 300) throw new Error(`Avatar download returned ${image.status}.`);
    const stored = await storage.upload(path, new Uint8Array(image.body), { contentType: image.contentType || "image/jpeg" });
    if (stored.error) throw stored.error;
    const { data: row, error } = await admin.from("avatars").insert({
      workspace_id: workspaceId, name, gender, age, look, description, storage_path: path,
      credits: AVATAR_CREDITS, created_by: auth.user.id,
    }).select("id").single();
    if (error || !row) throw error ?? new Error("Avatar row was not saved.");
    const { data: signed } = await storage.createSignedUrl(path, 3600);
    const { data: wallet } = await admin.from("workspaces").select("credits").eq("id", workspaceId).single();
    revalidatePath("/dashboard", "layout");
    return {
      avatar: { id: row.id as string, src: signed?.signedUrl ?? "", name, gender, age, look, yours: true },
      credits: (wallet?.credits as number | undefined) ?? 0,
    };
  } catch (err) {
    console.error("avatar creation failed", err);
    await admin.rpc("refund_credits", { ws: workspaceId, amount: AVATAR_CREDITS });
    await storage.remove([path]);
    return { error: t.createFailed };
  } finally {
    if (refPath) await storage.remove([refPath]);
  }
}
