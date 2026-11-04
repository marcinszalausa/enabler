"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canEditWorkspace, WORKSPACE_WRITE_DENIED } from "@/lib/workspace-access";
import { parseCampaign } from "@/lib/customer-workflow";

export type CampaignState = { error: string | null };
export async function createCampaign(_previous: CampaignState, form: FormData): Promise<CampaignState> {
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: ws } = await db.from("workspaces").select("id").order("created_at").limit(1).single();
  if (!ws || !(await canEditWorkspace(db, ws.id))) return { error: WORKSPACE_WRITE_DENIED };
  const plan = parseCampaign(Object.fromEntries(["id","name","goal","message","offer","scene"].map(key => [key,form.get(key)??""])));
  if (!plan) return { error: "Add a campaign name and main message. If you chose an offer, include its exact terms." };
  const productId = String(form.get("productId") ?? "");
  const { data: product } = await db.from("products").select("id").eq("id",productId).eq("workspace_id",ws.id).maybeSingle();
  if (!product) return { error: "Choose one of your products." };
  const { error } = await db.from("campaigns").insert({ ...plan, workspace_id: ws.id, product_id: product.id });
  if (error) {
    // An interrupted response may be retried: only resume the same owned plan.
    const { data: existing } = await db.from("campaigns").select("id,product_id,name,goal,message,offer,scene").eq("id",plan.id).eq("workspace_id",ws.id).maybeSingle();
    if (!existing || existing.product_id !== product.id || ["name","goal","message","offer","scene"].some(key => existing[key] !== plan[key as keyof typeof plan])) return { error: "We couldn’t save this campaign. Please try again." };
  }
  revalidatePath("/dashboard/campaigns");
  redirect(`/dashboard/products/${product.id}?campaign=${plan.id}#generate-ads`);
}
