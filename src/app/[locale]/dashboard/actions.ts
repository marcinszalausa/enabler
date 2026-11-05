"use server";
import {paidPlan} from "@/lib/paid-plans";

import { parseCreativePreferences, preferenceForm } from "@/lib/creative-preferences";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapePage } from "@/lib/scrape";
import { extractBrandBrief } from "@/lib/ai/claude";
import { runGeneration } from "@/lib/pipeline";
import { maybeAutoReload } from "@/lib/auto-reload";
import { imageRunCost, parseIdeas } from "@/lib/image-pricing";
import { DEFAULT_IMAGE_QUALITY, parseQuality } from "@/lib/quality";
import { runVideoGeneration } from "@/lib/video";
import { parseVideoOptions, videoRunCost } from "@/lib/video-options";
import { DEFAULT_LANGUAGE, isLanguageKey } from "@/lib/languages";
import { userMessage } from "@/lib/errors";
import { seedBrandKit, getBrandMemory } from "@/lib/brand-kit";
import { parseCampaign } from "@/lib/customer-workflow";
import { requestMessages } from "@/i18n/server";
import { fmt } from "@/i18n/format";
import { canEditWorkspace, WORKSPACE_WRITE_DENIED } from "@/lib/workspace-access";
import { ownsSourceImage, parseSourceField } from "@/lib/source-image";
import { canUseStyle, parseStyleField } from "@/lib/style-references";
import { canUseAvatar, parseAvatarField } from "@/lib/avatars";

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
  return { supabase, userId: auth.user.id, workspaceId: ws.id as string, canEdit: await canEditWorkspace(supabase, ws.id) };
}

export async function createProduct(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const rawUrl = String(formData.get("url") ?? "").trim();
  if (!rawUrl) return { error: (await requestMessages()).app.errors.pasteLink };
  // The customer confirms they may advertise this product and use its
  // photos and brand; we keep who confirmed it and when.
  if (formData.get("rightsConfirmed") !== "on") {
    return { error: (await requestMessages()).app.errors.confirmRights };
  }

  const { supabase, userId, workspaceId, canEdit } = await currentWorkspaceId();
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
        brand_brief: {
          ...brief,
          rights_confirmed_at: new Date().toISOString(),
          rights_confirmed_by: userId,
          ...(formData.get("onboardingKind") === "image" || formData.get("onboardingKind") === "video" ? { requires_personalization: true } : {}),
        },
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
  // A URL preference only; never a paid entitlement or a credit grant.
  const selectedPlan=formData.get("selectedPlan")?paidPlan(formData.get("selectedPlan")):null;
  const query=new URLSearchParams({...(setup==="image"||setup==="video"?{setup}:{}),...(selectedPlan?{plan:selectedPlan}:{})});
  redirect(`/dashboard/products/${productId}${query.size?"?"+query:""}`);
}

export async function startGeneration(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const productId = String(formData.get("productId") ?? "");
  const video = formData.get("kind") === "video";
  const options = video ? parseVideoOptions(formData) : null;
  const quality = options?.quality ?? parseQuality(formData.get("quality"), DEFAULT_IMAGE_QUALITY);
  const ideas = parseIdeas(formData.get("ideas"));
  const cost = options ? videoRunCost(options.length, quality) : imageRunCost(quality, ideas);
  const requested = formData.get("language");
  const language =
    options?.language ??
    (isLanguageKey(requested) ? requested : DEFAULT_LANGUAGE);
  const { supabase, workspaceId, canEdit } = await currentWorkspaceId();
  if (!canEdit) return { error: WORKSPACE_WRITE_DENIED };

  // RLS: only returns the product if the user is a member of its workspace.
  const { data: product } = await supabase
    .from("products")
    .select("id, workspace_id, brand_brief")
    .eq("id", productId)
    .single();
  if (!product || product.workspace_id !== workspaceId) {
    return { error: (await requestMessages()).app.errors.notFound };
  }

  const brief = product.brand_brief as { creative_preferences?: unknown; requires_personalization?: boolean } | null;
  let creativePreferences = parseCreativePreferences(brief?.creative_preferences);
  if (brief?.requires_personalization && !creativePreferences) {
    return { error: (await requestMessages()).personal.confirmFirst };
  }

  // The photo picked in the create card; none means the product's first.
  const sourceImage = parseSourceField(formData.get("source"));
  if (sourceImage && !(await ownsSourceImage(supabase, workspaceId, sourceImage))) {
    return { error: (await requestMessages()).picker.gone };
  }
  // A style reference to follow (image ads only).
  const styleId = video ? null : parseStyleField(formData.get("style"));
  if (styleId && !(await canUseStyle(supabase, workspaceId, styleId))) {
    return { error: (await requestMessages()).picker.gone };
  }
  // An AI avatar to feature (image ads only).
  const avatarId = video ? null : parseAvatarField(formData.get("avatar"));
  if (avatarId && !(await canUseAvatar(supabase, workspaceId, avatarId))) {
    return { error: (await requestMessages()).picker.gone };
  }

  const requestId = String(formData.get("requestId") ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) {
    return { error: (await requestMessages()).app.errors.couldntStart };
  }
  const admin = createAdminClient();
  const brandMemory = await getBrandMemory(supabase, workspaceId);
  const campaignId = String(formData.get("campaignId") ?? "");
  let campaign = null;
  if (campaignId) {
    const { data, error: campaignError } = await supabase.from("campaigns").select("id,name,goal,message,offer,scene").eq("id", campaignId).eq("workspace_id", workspaceId).eq("product_id", productId).maybeSingle();
    campaign = parseCampaign(data);
    if (campaignError || !campaign) return { error: "This campaign could not be loaded. Choose it again before creating ads." };
    // A previous product offer must not leak into a new campaign.
    creativePreferences = {
      promotion: campaign.goal === "offer" ? "offer" : "product",
      audience: creativePreferences?.audience || brandMemory.audience || "Customers described by the product page",
      focus: campaign.message,
      offer: campaign.offer,
    };
  }
  const { data: generationId, error } = await admin.rpc("reserve_generation", {
    ws: workspaceId,
    request_id: requestId,
    product: productId,
    generation_type: video ? "video_ads" : "image_ads",
    generation_model: `claude + fal ${video ? "video" : "image"} ${quality}`,
    amount: cost,
    options: { ...(options ?? { language, quality, ideas }), ...(creativePreferences ? { creative_preferences: creativePreferences } : {}), brand_memory: brandMemory, ...(campaign ? { campaign } : {}), ...(sourceImage ? { source_image: sourceImage } : {}), ...(styleId ? { style_reference: { id: styleId } } : {}), ...(avatarId ? { avatar: { id: avatarId } } : {}) },
  });
  if (error) {
    if(error.code==="P0001"&&error.message==="TRIAL_BATCH_ACTIVE")return {error:(await requestMessages()).trial.busy};
    if(error.code==="P0001"&&error.message==="TRIAL_BATCH_RATE")return {error:(await requestMessages()).trial.rate};
    console.error("reserve generation failed", error);
    return { error: (await requestMessages()).app.errors.couldntStart };
  }
  // Tops the balance up with the saved card when auto-reload is on.
  after(() => maybeAutoReload(workspaceId));
  if (!generationId) {
    return { error: fmt((await requestMessages()).app.errors.noCredits, { cost }) };
  }

  const job = { generationId: String(generationId), workspaceId, productId, creativePreferences };
  after(() =>
    options
      ? runVideoGeneration({ ...job, options })
      : runGeneration({ ...job, language, quality, ideas }),
  );

  revalidatePath(`/dashboard/products/${productId}`);
  return { error: null };
}

export type PreferenceState = { error: string | null; saved: boolean };
export async function saveCreativePreferences(_prev: PreferenceState, form: FormData): Promise<PreferenceState> {
  const { supabase, workspaceId, canEdit } = await currentWorkspaceId();
  if (!canEdit) return { error: WORKSPACE_WRITE_DENIED, saved: false };
  const preferences=preferenceForm(form);
  if (!preferences) return { error: (await requestMessages()).personal.invalid, saved: false };
  const productId=String(form.get("productId")??"");
  const {data:product,error:readError}=await supabase.from("products").select("id, brand_brief")
    .eq("id",productId).eq("workspace_id",workspaceId).maybeSingle();
  if (readError || !product?.brand_brief || typeof product.brand_brief!=="object") {
    return {error:(await requestMessages()).app.errors.notFound,saved:false};
  }
  const {data:updated,error}=await supabase.from("products").update({
    brand_brief:{...product.brand_brief,creative_preferences:preferences,preferences_confirmed_at:typeof product.brand_brief.preferences_confirmed_at==="string"?product.brand_brief.preferences_confirmed_at:new Date().toISOString()},
  }).eq("id",productId).eq("workspace_id",workspaceId).select("id").maybeSingle();
  if (error || !updated) return {error:(await requestMessages()).personal.couldntSave,saved:false};
  revalidatePath("/dashboard/products/"+productId);
  return {error:null,saved:true};
}
