"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requestMessages } from "@/i18n/server";

export type ProductFavoriteState = { favorite: boolean; error: string | null };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// RLS keeps favorites personal and limited to products the user can see.
export async function setProductFavorite(previous: ProductFavoriteState, form: FormData): Promise<ProductFavoriteState> {
  const t = await requestMessages();
  const id = form.get("productId"), wanted = form.get("favorite");
  if (typeof id !== "string" || !UUID.test(id) || (wanted !== "1" && wanted !== "0")) return { ...previous, error: t.library.saveError };
  const client = await createClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) return { ...previous, error: t.library.saveError };
  const result = wanted === "1"
    ? await client.from("product_favorites").upsert({ user_id: auth.user.id, product_id: id }, { onConflict: "user_id,product_id", ignoreDuplicates: true })
    : await client.from("product_favorites").delete().eq("user_id", auth.user.id).eq("product_id", id);
  if (result.error) return { ...previous, error: t.library.saveError };
  revalidatePath("/dashboard");
  return { favorite: wanted === "1", error: null };
}
