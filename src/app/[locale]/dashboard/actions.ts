"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapePage } from "@/lib/scrape";
import { extractBrandBrief } from "@/lib/ai/claude";
import { GENERATION_COST, runGeneration } from "@/lib/pipeline";
import { runVideoGeneration } from "@/lib/video";
import { parseVideoOptions, videoRunCost } from "@/lib/video-options";
import { DEFAULT_LANGUAGE, isLanguageKey } from "@/lib/languages";
import { userMessage } from "@/lib/errors";
import { seedBrandKit } from "@/lib/brand-kit";
import { requestMessages } from "@/i18n/server";
import { fmt } from "@/i18n/format";
import { canEditWorkspace, WORKSPACE_WRITE_DENIED } from "@/lib/workspace-access";

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
  return { supabase, workspaceId: ws.id as string, canEdit: await canEditWorkspace(supabase, ws.id) };
}

export async function createProduct(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const rawUrl = String(formData.get("url") ?? "").trim();
  if (!rawUrl) return { error: (await requestMessages()).app.errors.pasteLink };

  const { supabase, workspaceId, canEdit } = await currentWorkspaceId();
  if (!canEdit) return { error: WORKSPACE_WRITE_DENIED };

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

  const setup = formData.get("onboardingKind");
  redirect(`/dashboard/products/${productId}${setup === "image" || setup === "video" ? "?setup=" + setup : ""}`);
}

export async function startGeneration(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const productId = String(formData.get("productId") ?? "");
  const video = formData.get("kind") === "video";
  const options = video ? parseVideoOptions(formData) : null;
  const cost = options ? videoRunCost(options.length) : GENERATION_COST;
  const requested = formData.get("language");
  const language =
    options?.language ??
    (isLanguageKey(requested) ? requested : DEFAULT_LANGUAGE);
  const { supabase, workspaceId, canEdit } = await currentWorkspaceId();
  if (!canEdit) return { error: WORKSPACE_WRITE_DENIED };

  // RLS: only returns the product if the user is a member of its workspace.
  const { data: product } = await supabase
    .from("products")
    .select("id, workspace_id")
    .eq("id", productId)
    .single();
  if (!product || product.workspace_id !== workspaceId) {
    return { error: (await requestMessages()).app.errors.notFound };
  }

  const requestId = String(formData.get("requestId") ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) {
    return { error: (await requestMessages()).app.errors.couldntStart };
  }
  const admin = createAdminClient();
  const { data: generationId, error } = await admin.rpc("reserve_generation", {
    ws: workspaceId,
    request_id: requestId,
    product: productId,
    generation_type: video ? "video_ads" : "image_ads",
    generation_model: video
      ? "claude-opus-5-5 + fal flux + kling 2.6"
      : "claude-opus-5-5 + fal flux",
    amount: cost,
    options: options ?? { language },
  });
  if (error) {
    console.error("reserve generation failed", error);
    return { error: (await requestMessages()).app.errors.couldntStart };
  }
  if (!generationId) {
    return { error: fmt((await requestMessages()).app.errors.noCredits, { cost }) };
  }

  const job = { generationId: String(generationId), workspaceId, productId };
  after(() =>
    options
      ? runVideoGeneration({ ...job, options })
      : runGeneration({ ...job, language }),
  );

  revalidatePath(`/dashboard/products/${productId}`);
  return { error: null };
}
