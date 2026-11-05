import "server-only";
import { generationDirection } from "@/lib/generation-direction";
import {inspectAdImage} from "@/lib/media-quality";
import {IMAGE_QUALITY_ATTEMPTS,QualityError,QualityReviewUnavailableError,reviewedCandidate} from "@/lib/media-quality-policy";
export {QualityError} from "@/lib/media-quality-policy";
import { withCreativePreferences, type CreativePreferences } from "@/lib/creative-preferences";
import { fetchPublicUrl } from "@/lib/public-fetch";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimGeneration, finalizeGeneration } from "@/lib/generation-credits";
import { reviewAdImage, writeAdAngles, type BrandBrief } from "@/lib/ai/claude";
import { generateAdImage, type Aspect } from "@/lib/ai/fal";
import { userMessage } from "@/lib/errors";
import { autopilotRun } from "@/lib/social/publish";
import type { LanguageKey } from "@/lib/languages";
import type { Quality } from "@/lib/quality";

import { ASPECTS, ADS_PER_GENERATION, GENERATION_COST, type IdeaCount } from "@/lib/image-pricing";
export { ASPECTS, ADS_PER_GENERATION, CREDITS_PER_IMAGE, GENERATION_COST } from "@/lib/image-pricing";

// fal limits how many requests an account may run at once; stay under it.
const IMAGE_CONCURRENCY = 3;


type Job = {
  generationId: string;
  workspaceId: string;
  productId: string;
  language: LanguageKey;
  quality: Quality;
  // Ad ideas to write; each is made in every size.
  ideas?: IdeaCount;
  creativePreferences?: CreativePreferences | null;
};

// Runs one ad generation end to end: copy, images, storage, rows.
// Credits were spent up front; a failed run refunds them.
export async function runGeneration({
  generationId,
  workspaceId,
  productId,
  language,
  quality,
  ideas = ADS_PER_GENERATION,
  creativePreferences,
}: Job) {
  let expected = ideas * ASPECTS.length;
  let isRevision=false;
  const db = createAdminClient();
  if (!(await claimGeneration(db, generationId))) return;
  let delivered = 0;
  let prompt: string | null = null;
  let failure: string | null = null;

  try {
    const { data: product, error } = await db
      .from("products")
      .select("brand_brief, image_urls")
      .eq("id", productId)
      .single();
    if (error || !product?.brand_brief) throw new Error("Product not found.");

    const direction = await generationDirection(db, generationId, workspaceId);
    const revision=direction.revision;isRevision=!!revision;
    if(revision?.kind==="video")throw new Error("Revision media type mismatch.");
    if(revision)expected=1;
    const brief = { ...withCreativePreferences(product.brand_brief as BrandBrief, creativePreferences), ...direction };
    if (direction.brand_memory?.tone) brief.tone = direction.brand_memory.tone;
    if (!brief.creative_preferences && direction.brand_memory?.audience) brief.audience = direction.brand_memory.audience;
    const productReferenceImageUrl = (product.image_urls as string[])[0] ?? null;
    let referenceImageUrl=productReferenceImageUrl;
    if(revision){
      if(!revision.storage_path.startsWith(workspaceId+"/"))throw new Error("Revision source is unavailable.");
      const {data:signed,error:signError}=await db.storage.from("creatives").createSignedUrl(revision.storage_path,3600);
      if(signError||!signed?.signedUrl)throw signError??new Error("Revision source is unavailable.");
      referenceImageUrl=signed.signedUrl;
    }
    const written = await writeAdAngles(brief, revision?1:ideas, language);
    const angles = revision?written.slice(0,1).map(ad=>({...ad,headline:revision.headline,primary_text:revision.primary_text,cta:revision.cta,angle:revision.angle})):written;
    if(revision&&angles.length!==1)throw new Error("No revision direction was created.");

    const tasks = angles.flatMap((ad, i) =>
      (revision?[revision.aspect]:ASPECTS).map((aspect) => async () => {
        const imageUrl = await generateCheckedImage({
          prompt: ad.image_prompt,
          aspect,
          quality,
          referenceImageUrl,
          productReferenceImageUrl,
          product: brief.product_name,
        });
        const image = await fetchPublicUrl(imageUrl, { maxBytes: 8*1024*1024, timeoutMs: 30000, accept: "image/*" });
        if (image.status < 200 || image.status >= 300) throw new Error("Couldn't download generated image.");

        const path = `${workspaceId}/${generationId}/${i + 1}-${aspect.replace(":", "x")}.jpg`;
        const upload = await db.storage
          .from("creatives")
          .upload(path, new Uint8Array(image.body).buffer, {
            contentType: "image/jpeg",
            upsert: true,
          });
        if (upload.error) throw upload.error;

        const creative = {
          workspace_id: workspaceId,
          generation_id: generationId,
          kind: "image" as const,
          aspect,
          storage_path: path,
          angle: ad.angle,
          headline: ad.headline,
          primary_text: ad.primary_text,
          cta: ad.cta,
        };
        // Checkpoint each delivered ad before starting the next task. A killed
        // worker can then be settled from durable rows by the database sweep.
        const { error: saveError } = await db.from("creatives").insert(creative);
        if (saveError) throw saveError;
        return creative;
      }),
    );

    const results = await settleWithLimit(tasks, IMAGE_CONCURRENCY);
    for (const r of results) {
      if (r.status === "rejected")
        console.error("image failed", generationId, r.reason);
    }
    const creatives = results.flatMap((r) =>
      r.status === "fulfilled" ? [r.value] : [],
    );
    if (creatives.length === 0) {
      const firstError = results.find(
        (r) => r.status === "rejected",
      ) as PromiseRejectedResult;
      throw firstError?.reason ?? new Error("No images were generated.");
    }

    delivered = creatives.length;
    const failed = expected - delivered;
    prompt = angles.map((a) => a.image_prompt).join("\n");
    failure = failed > 0 ? failureNote(results, failed) : null;
  } catch (err) {
    // Say why, so a run that the quality check stopped does not look broken.
    failure = err instanceof QualityError
      ? `The quality check rejected every image: ${err.message}`
      : err instanceof QualityReviewUnavailableError
        ? err.message
        : userMessage(err, "Generation failed. Please try again.");
    console.error("generation failed", generationId, err);
  }

  // An insert can commit even if its response is lost. Count durable outputs,
  // rather than treating a rejected request as proof that nothing was saved.
  const { count, error: countError } = await db.from("creatives")
    .select("id", { count: "exact", head: true })
    .eq("generation_id", generationId).eq("workspace_id", workspaceId).eq("kind", "image");
  if (countError || count === null) throw countError ?? new Error("Missing output count.");
  delivered = count;
  if (delivered === expected) failure = null;

  // Refund at the price the run was charged, even if prices changed since.
  const { data: charged } = await db.from("generations")
    .select("cost_credits").eq("id", generationId).single();
  const cost = (charged?.cost_credits as number | undefined) ?? GENERATION_COST;
  const perImage = cost / expected;

  // Keep settlement outside the generation catch. A lost RPC response must not
  // turn a successful partial delivery into a second, full refund.
  const closed = await finalizeGeneration(
    db, generationId, delivered > 0 ? "succeeded" : "failed",
    cost - delivered * perImage, failure, prompt,
  );
  if (closed && delivered > 0 && !isRevision) await autopilotRun(workspaceId, generationId);
}

// Both local decoding and a visual verdict are required before delivery.
// Review outages retry the same candidate, never approve or regenerate it.
export async function generateCheckedImage(opts:{
 prompt:string;aspect:Aspect;quality:Quality;referenceImageUrl:string|null;
 productReferenceImageUrl?:string|null;sameScene?:boolean;product:string;
}):Promise<string>{
 return reviewedCandidate({
  // The last try steps up one quality tier, at our cost, so a hard product
  // still gets a strong final attempt.
  generate:(attempt,avoid)=>generateAdImage({...opts,avoid,retry:attempt>1,
   quality:attempt===IMAGE_QUALITY_ATTEMPTS?stepUp(opts.quality):opts.quality}),
  validate:async imageUrl=>{
   const image=await fetchPublicUrl(imageUrl,{maxBytes:8*1024*1024,timeoutMs:30000,accept:"image/*"});
   if(image.status<200||image.status>=300)throw new QualityReviewUnavailableError("The generated photo could not be inspected.");
   await inspectAdImage(image.body,opts.aspect);
  },
  review:imageUrl=>reviewAdImage({...opts,imageUrl,
   referenceImageUrl:opts.productReferenceImageUrl!==undefined?opts.productReferenceImageUrl:opts.referenceImageUrl,
   continuityImageUrl:opts.sameScene?opts.referenceImageUrl:null
  })
 });
}

function stepUp(quality:Quality):Quality{return quality==="good"?"better":"best";}

// Says why images were dropped, so the owner can see what the checker caught.
function failureNote(
  results: PromiseSettledResult<unknown>[],
  failed: number,
): string {
  const rejected = results.find(
    (r) => r.status === "rejected" && r.reason instanceof QualityError,
  ) as PromiseRejectedResult | undefined;
  const base = `${failed} image(s) were dropped and refunded.`;
  return rejected
    ? `${base} The quality check found, for example: ${(rejected.reason as Error).message}`
    : base;
}

// Like Promise.allSettled, but runs at most `limit` tasks at a time.
export async function settleWithLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await tasks[i]() };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, worker),
  );
  return results;
}
