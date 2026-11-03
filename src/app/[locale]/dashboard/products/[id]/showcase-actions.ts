"use server";

import { revalidatePath, updateTag } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canEditWorkspace } from "@/lib/workspace-access";
import { SHOWCASE_TAG, isShowcaseAdmin } from "@/lib/showcase";

// Puts a finished run on (or takes it off) the public site: image runs on
// /use-cases and the home page, video runs in the home page phones.
export async function setShowcase(formData: FormData) {
  const user = await getCurrentUser();
  if (!isShowcaseAdmin(user.email)) return;

  const generationId = String(formData.get("generationId") ?? "");
  const show = formData.get("show") === "1";

  // RLS: the run must be in one of the caller's workspaces.
  const supabase = await createClient();
  const { data: generation } = await supabase
    .from("generations")
    .select("id, product_id, status, workspace_id")
    .eq("id", generationId)
    .maybeSingle();
  if (!generation || generation.status !== "succeeded") return;
  if (!(await canEditWorkspace(supabase, generation.workspace_id))) return;

  await createAdminClient()
    .from("generations")
    .update({ showcased_at: show ? new Date().toISOString() : null })
    .eq("id", generation.id).eq("workspace_id", generation.workspace_id);

  // Expire now, so the next visit shows the change.
  updateTag(SHOWCASE_TAG);
  revalidatePath(`/dashboard/products/${generation.product_id}`);
}
