import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimGeneration, finalizeGeneration } from "@/lib/generation-credits";
import { reviewAdImage, writeAdAngles, type BrandBrief } from "@/lib/ai/claude";
import { generateAdImage, type Aspect } from "@/lib/ai/fal";
import { userMessage } from "@/lib/errors";
import { autopilotRun } from "@/lib/social/publish";
import type { LanguageKey } from "@/lib/languages";

export const ASPECTS: Aspect[] = ["1:1", "9:16"];
export const ADS_PER_GENERATION = 5;
export const CREDITS_PER_IMAGE = 1;
export const GENERATION_COST =
  ADS_PER_GENERATION * ASPECTS.length * CREDITS_PER_IMAGE;

// fal limits how many requests an account may run at once; stay under it.
const IMAGE_CONCURRENCY = 3;
// Tries per image before giving up on it (and refunding its credit).
const IMAGE_ATTEMPTS = 3;

type Job = {
  generationId: string;
  workspaceId: string;
  productId: string;
  language: LanguageKey;
};

// Runs one ad generation end to end: copy, images, storage, rows.
// Credits were spent up front; a failed run refunds them.
export async function runGeneration({
  generationId,
  workspaceId,
  productId,
  language,
}: Job) {
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

    const brief = product.brand_brief as BrandBrief;
    const referenceImageUrl = (product.image_urls as string[])[0] ?? null;
    const angles = await writeAdAngles(brief, ADS_PER_GENERATION, language);

    const tasks = angles.flatMap((ad, i) =>
      ASPECTS.map((aspect) => async () => {
        const imageUrl = await generateCheckedImage({
          prompt: ad.image_prompt,
          aspect,
          referenceImageUrl,
          product: brief.product_name,
        });
        const image = await fetch(imageUrl, {
          signal: AbortSignal.timeout(30_000),
        });
        if (!image.ok) throw new Error("Couldn't download generated image.");

        const path = `${workspaceId}/${generationId}/${i + 1}-${aspect.replace(":", "x")}.jpg`;
        const upload = await db.storage
          .from("creatives")
          .upload(path, await image.arrayBuffer(), {
            contentType: "image/jpeg",
            upsert: true,
          });
        if (upload.error) throw upload.error;

        return {
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

    const insert = await db.from("creatives").insert(creatives);
    if (insert.error) throw insert.error;

    delivered = creatives.length;
    const failed = ADS_PER_GENERATION * ASPECTS.length - delivered;
    prompt = angles.map((a) => a.image_prompt).join("\n");
    failure = failed > 0 ? failureNote(results, failed) : null;
  } catch (err) {
    failure = userMessage(err, "Generation failed. Please try again.");
    console.error("generation failed", generationId, err);
  }

  // Keep settlement outside the generation catch. A lost RPC response must not
  // turn a successful partial delivery into a second, full refund.
  const closed = await finalizeGeneration(
    db, generationId, delivered > 0 ? "succeeded" : "failed",
    GENERATION_COST - delivered * CREDITS_PER_IMAGE, failure, prompt,
  );
  if (closed && delivered > 0) await autopilotRun(workspaceId, generationId);
}

// An image that kept failing the quality check; the message says why.
export class QualityError extends Error {}

// Generates an ad photo and has Claude check it for broken hands, faces or
// a product that doesn't match; retries with the defects named. An image that
// never passes fails, so its credit is refunded rather than shipping a flaw.
export async function generateCheckedImage(opts: {
  prompt: string;
  aspect: Aspect;
  referenceImageUrl: string | null;
  sameScene?: boolean;
  product: string;
}): Promise<string> {
  let avoid: string | undefined;
  for (let attempt = 1; attempt <= IMAGE_ATTEMPTS; attempt++) {
    // Retries use the more precise model.
    const imageUrl = await generateAdImage({
      ...opts,
      avoid,
      best: attempt > 1,
    });
    let review;
    try {
      review = await reviewAdImage({ ...opts, imageUrl });
    } catch (err) {
      // A checker outage shouldn't block ads; keep the image.
      console.error("image review failed", err);
      return imageUrl;
    }
    if (review.ok) return imageUrl;
    console.warn("image rejected", attempt, review.issues);
    avoid = review.issues;
  }
  throw new QualityError(avoid ?? "visible defects");
}

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
