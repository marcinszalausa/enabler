"use server";

import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canEditWorkspace } from "@/lib/workspace-access";
import { requestMessages } from "@/i18n/server";
import { UPLOAD_MAX_BYTES, UPLOAD_MAX_SIDE, uploadFolder } from "@/lib/source-image";

export type PickerImage = {
  // The picker's form value: "product:<url>" or "upload:<path>".
  value: string;
  src: string;
  productId: string;
  uploaded: boolean;
};
export type PickerProduct = { id: string; name: string; photo: string | null };
export type PickerData = { products: PickerProduct[]; images: PickerImage[] };

// Most store pages list a handful of photos; a few list dozens of variants.
const PHOTOS_PER_PRODUCT = 24;

// Every photo the workspace can start an ad from: each product's store
// photos and the photos its owners uploaded, newest uploads first.
export async function listPickerImages(): Promise<PickerData> {
  const supabase = await createClient();
  const { data: ws } = await supabase.from("workspaces").select("id").order("created_at").limit(1).single();
  if (!ws) return { products: [], images: [] };
  const [{ data: products }, { data: uploads }] = await Promise.all([
    supabase.from("products").select("id, name, url, image_urls").eq("workspace_id", ws.id).order("created_at", { ascending: false }),
    supabase.from("media_uploads").select("product_id, storage_path").eq("workspace_id", ws.id).order("created_at", { ascending: false }).limit(300),
  ]);
  const paths = (uploads ?? []).map((u) => u.storage_path as string);
  const { data: signed } = paths.length
    ? await supabase.storage.from("creatives").createSignedUrls(paths, 3600)
    : { data: [] };
  const signedBy = new Map((signed ?? []).flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));

  const images: PickerImage[] = [];
  for (const u of uploads ?? []) {
    const src = signedBy.get(u.storage_path as string);
    if (src) images.push({ value: `upload:${u.storage_path}`, src, productId: u.product_id as string, uploaded: true });
  }
  for (const p of products ?? []) {
    for (const url of ((p.image_urls as string[] | null) ?? []).slice(0, PHOTOS_PER_PRODUCT)) {
      images.push({ value: `product:${url}`, src: url, productId: p.id as string, uploaded: false });
    }
  }
  return {
    products: (products ?? []).map((p) => ({
      id: p.id as string,
      name: (p.name as string | null) ?? (p.url as string).replace(/^https?:\/\/(www\.)?/, ""),
      photo: ((p.image_urls as string[] | null) ?? [])[0] ?? null,
    })),
    images,
  };
}

export type UploadResult = { error: string } | { image: PickerImage };

// Saves one photo for a product. The browser has already scaled it down;
// the server decodes it again, so only real images are stored.
export async function uploadProductImage(form: FormData): Promise<UploadResult> {
  const t = (await requestMessages()).picker;
  const productId = String(form.get("productId") ?? "");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: t.uploadFailed };
  if (file.size > UPLOAD_MAX_BYTES) return { error: t.tooBig };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: t.uploadFailed };
  // RLS: only returns the product to members of its workspace.
  const { data: product } = await supabase.from("products").select("id, workspace_id").eq("id", productId).maybeSingle();
  if (!product) return { error: t.uploadFailed };
  const ws = product.workspace_id as string;
  if (!(await canEditWorkspace(supabase, ws))) return { error: t.uploadFailed };

  let jpeg: Buffer;
  let size: { width?: number; height?: number };
  try {
    const out = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 80_000_000 })
      .rotate()
      .resize({ width: UPLOAD_MAX_SIDE, height: UPLOAD_MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    jpeg = out.data;
    size = out.info;
  } catch {
    return { error: t.badType };
  }
  if (!size.width || !size.height || Math.min(size.width, size.height) < 256) return { error: t.tooSmall };

  const admin = createAdminClient();
  const path = `${uploadFolder(ws, product.id as string)}/${crypto.randomUUID()}.jpg`;
  const stored = await admin.storage.from("creatives").upload(path, new Uint8Array(jpeg), { contentType: "image/jpeg" });
  if (stored.error) {
    console.error("photo upload failed", stored.error.message);
    return { error: t.uploadFailed };
  }
  const { error } = await admin.from("media_uploads").insert({
    workspace_id: ws, product_id: product.id, storage_path: path,
    width: size.width, height: size.height, created_by: auth.user.id,
  });
  if (error) {
    await admin.storage.from("creatives").remove([path]);
    console.error("photo upload row failed", error.message);
    return { error: t.uploadFailed };
  }
  const { data: signed } = await admin.storage.from("creatives").createSignedUrl(path, 3600);
  return { image: { value: `upload:${path}`, src: signed?.signedUrl ?? "", productId: product.id as string, uploaded: true } };
}
