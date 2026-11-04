"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/admin";
import { parseCreditGrant } from "@/lib/admin-stats";

export type GrantState = { error: string | null; done: string | null };

// Adds (or with a minus sign, removes) credits on a customer's workspace.
// The admin is verified here and again inside the database function.
export async function grantCredits(_prev: GrantState, form: FormData): Promise<GrantState> {
  const { data } = await (await createClient()).auth.getUser();
  const admin = data.user;
  if (!admin || !(await isPlatformAdmin(admin.id))) return { error: "Only Gooidy admins can change credits.", done: null };
  const grant = parseCreditGrant(form.get("workspaceId"), form.get("amount"), form.get("note"));
  if ("error" in grant) return { error: grant.error, done: null };
  const { data: balance, error } = await createAdminClient().rpc("admin_grant_credits", {
    ws: grant.workspaceId, admin: admin.id, amount: grant.amount, note: grant.note,
  });
  if (error) {
    const negative = error.message.includes("NEGATIVE_BALANCE") || error.code === "23514";
    const missing = error.code === "PGRST202";
    return {
      error: negative ? "That would take the balance below zero." : missing ? "Run the admin credits SQL in Supabase first." : "Couldn't change credits. Try again.",
      done: null,
    };
  }
  revalidatePath(`/dashboard/admin/customers/${grant.workspaceId}`);
  const n = Math.abs(grant.amount).toLocaleString("en-US");
  return { error: null, done: `${grant.amount > 0 ? "Added" : "Removed"} ${n} credits. New balance: ${Number(balance).toLocaleString("en-US")}.` };
}
