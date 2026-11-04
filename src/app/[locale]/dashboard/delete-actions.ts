"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canEditWorkspace } from "@/lib/workspace-access";
import { deletePost } from "@/lib/social/zernio";
import { deleteAd, deleteProduct, type DeleteOutcome } from "@/lib/deletion";
import { requestMessages } from "@/i18n/server";

export type DeleteState = { error: string | null; done: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function deps() {
  return { client: await createClient(), admin: createAdminClient(), canEdit: canEditWorkspace, cancelPost: deletePost };
}

async function message(outcome: DeleteOutcome) {
  const t = (await requestMessages()).remove;
  return outcome === "busy" ? t.busy : outcome === "showcased" ? t.showcased : t.error;
}

export async function deleteAdAction(_: DeleteState, form: FormData): Promise<DeleteState> {
  const id = form.get("creativeId");
  if (typeof id !== "string" || !UUID.test(id)) return { error: await message("error"), done: false };
  const outcome = await deleteAd(await deps(), id);
  // Already gone counts as done: a second click or another tab got there first.
  if (outcome !== "ok" && outcome !== "missing") return { error: await message(outcome), done: false };
  revalidatePath("/dashboard", "layout");
  return { error: null, done: true };
}

export async function deleteProductAction(_: DeleteState, form: FormData): Promise<DeleteState> {
  const id = form.get("productId");
  if (typeof id !== "string" || !UUID.test(id)) return { error: await message("error"), done: false };
  const outcome = await deleteProduct(await deps(), id);
  if (outcome !== "ok" && outcome !== "missing") return { error: await message(outcome), done: false };
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard?deleted=1");
}
