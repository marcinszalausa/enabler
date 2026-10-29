"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapePage } from "@/lib/scrape";
import { extractBrandBrief } from "@/lib/ai/claude";
import { GENERATION_COST, runGeneration } from "@/lib/pipeline";
import { userMessage } from "@/lib/errors";
import { seedBrandKit } from "@/lib/brand-kit";

export type FormState = { error: string | null };

async function currentWorkspaceId() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: ws } = await supabase
    .from("workspaces")
    .select("id")
    .order("created_at")
    .limit(1)
    .single();
  if (!ws) throw new Error("No workspace found.");
  return { supabase, workspaceId: ws.id as string };
}

export async function createProduct(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const rawUrl = String(formData.get("url") ?? "").trim();
  if (!rawUrl) return { error: "Paste a product or website link." };

  const { supabase, workspaceId } = await currentWorkspaceId();

  let productId: string;
  try {
    const page = await scrapePage(rawUrl);
    const brief = await extractBrandBrief(page);
    const { data, error } = await supabase
      .from("products")
      .insert({
        workspace_id: workspaceId,
        url: page.url,
        name: brief.product_name,
        description: brief.summary,
        price: brief.price ?? page.price,
        image_urls: page.imageUrls,
        brand_brief: brief,
      })
      .select("id")
      .single();
    if (error) throw error;
    productId = data.id;
    after(() => seedBrandKit(workspaceId, page));
  } catch (err) {
    console.error("createProduct failed", err);
    return { error: userMessage(err) };
  }

  redirect(`/dashboard/products/${productId}`);
}

export async function startGeneration(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const productId = String(formData.get("productId") ?? "");
  const { supabase, workspaceId } = await currentWorkspaceId();

  // RLS: only returns the product if the user is a member of its workspace.
  const { data: product } = await supabase
    .from("products")
    .select("id, workspace_id")
    .eq("id", productId)
    .single();
  if (!product || product.workspace_id !== workspaceId) {
    return { error: "Product not found." };
  }

  const admin = createAdminClient();
  const { data: spent } = await admin.rpc("spend_credits", {
    ws: workspaceId,
    amount: GENERATION_COST,
  });
  if (!spent) {
    return { error: `Not enough credits. Each run uses ${GENERATION_COST}.` };
  }

  const { data: generation, error } = await admin
    .from("generations")
    .insert({
      workspace_id: workspaceId,
      product_id: productId,
      type: "image_ads",
      model: "claude-opus-5-5 + fal flux",
      cost_credits: GENERATION_COST,
    })
    .select("id")
    .single();
  if (error || !generation) {
    await admin.rpc("refund_credits", {
      ws: workspaceId,
      amount: GENERATION_COST,
    });
    return { error: "Couldn't start the generation." };
  }

  after(() =>
    runGeneration({ generationId: generation.id, workspaceId, productId }),
  );

  revalidatePath(`/dashboard/products/${productId}`);
  return { error: null };
}
