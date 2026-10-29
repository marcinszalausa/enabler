"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { storeLogo } from "@/lib/brand-kit";
import { LOGO_TYPES, MAX_LOGO_BYTES, isFontKey, isHexColor } from "@/lib/brand";
import { userMessage } from "@/lib/errors";
import { requestMessages } from "@/i18n/server";

export type BrandFormState = { error: string | null; saved: boolean };

export async function saveBrandKit(
  _prev: BrandFormState,
  formData: FormData,
): Promise<BrandFormState> {
  const supabase = await createClient();
  const { errors } = (await requestMessages()).app;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: ws } = await supabase
    .from("workspaces")
    .select("id")
    .order("created_at")
    .limit(1)
    .single();
  if (!ws) return { error: "No workspace found.", saved: false };

  const accent = String(formData.get("accent_color") ?? "").toLowerCase();
  const font = formData.get("font");
  if (!isHexColor(accent)) return { error: errors.color, saved: false };
  if (!isFontKey(font)) return { error: errors.font, saved: false };

  const logo = formData.get("logo");
  const hasLogo = logo instanceof File && logo.size > 0;
  if (hasLogo && !(LOGO_TYPES as readonly string[]).includes(logo.type)) {
    return { error: errors.logoType, saved: false };
  }
  if (hasLogo && logo.size > MAX_LOGO_BYTES) {
    return { error: errors.logoSize, saved: false };
  }

  // Saved with the user's client, so RLS decides who may edit the kit.
  const { error } = await supabase.from("brand_kits").upsert({
    workspace_id: ws.id,
    accent_color: accent,
    font,
    updated_at: new Date().toISOString(),
    ...(formData.get("remove_logo") === "on" && !hasLogo
      ? { logo_path: null }
      : {}),
  });
  if (error) {
    console.error("brand kit save failed", error);
    return { error: errors.couldntSave, saved: false };
  }

  if (hasLogo) {
    try {
      const logoPath = await storeLogo(
        ws.id,
        await logo.arrayBuffer(),
        logo.type,
      );
      const { error: logoError } = await supabase
        .from("brand_kits")
        .update({ logo_path: logoPath })
        .eq("workspace_id", ws.id);
      if (logoError) throw logoError;
    } catch (err) {
      console.error("logo upload failed", err);
      return {
        error: userMessage(err, "Couldn't upload the logo."),
        saved: false,
      };
    }
  }

  revalidatePath("/dashboard", "layout");
  return { error: null, saved: true };
}
