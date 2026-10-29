"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapePage } from "@/lib/scrape";
import { extractBrandBrief } from "@/lib/ai/claude";
import { GENERATION_COST, runGeneration } from "@/lib/pipeline";
import { VIDEO_GENERATION_COST, runVideoGeneration } from "@/lib/video";
import { parseVideoOptions } from "@/lib/video-options";
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
  const video = formData.get("kind") === "video";
  const cost = video ? VIDEO_GENERATION_COST : GENERATION_COST;
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
    amount: cost,
  });
  if (!spent) {
    return { error: `Not enough credits. This run uses ${cost}.` };
  }

  const { data: generation, error } = await admin
    .from("generations")
    .insert({
      workspace_id: workspaceId,
      product_id: productId,
      type: video ? "video_ads" : "image_ads",
      model: video
        ? "claude-opus-5-5 + fal flux + kling 2.6"
        : "claude-opus-5-5 + fal flux",
      cost_credits: cost,
    })
    .select("id")
    .single();
  if (error || !generation) {
    await admin.rpc("refund_credits", {
      ws: workspaceId,
      amount: cost,
    });
    return { error: "Couldn't start the generation." };
  }

  const job = { generationId: generation.id, workspaceId, productId };
  const options = video ? parseVideoOptions(formData) : null;
  after(() =>
    options ? runVideoGeneration({ ...job, options }) : runGeneration(job),
  );

  revalidatePath(`/dashboard/products/${productId}`);
  return { error: null };
}
