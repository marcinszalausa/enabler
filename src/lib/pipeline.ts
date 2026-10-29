import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAdAngles, type BrandBrief } from "@/lib/ai/claude";
import { generateAdImage, type Aspect } from "@/lib/ai/fal";
import { userMessage } from "@/lib/errors";

export const ASPECTS: Aspect[] = ["1:1", "9:16"];
export const ADS_PER_GENERATION = 5;
export const CREDITS_PER_IMAGE = 1;
export const GENERATION_COST =
  ADS_PER_GENERATION * ASPECTS.length * CREDITS_PER_IMAGE;

// fal limits how many requests an account may run at once; stay under it.
const IMAGE_CONCURRENCY = 3;

type Job = { generationId: string; workspaceId: string; productId: string };

// Runs one ad generation end to end: copy, images, storage, rows.
// Credits were spent up front; a failed run refunds them.
export async function runGeneration({
  generationId,
  workspaceId,
  productId,
}: Job) {
  const db = createAdminClient();
  await db
    .from("generations")
    .update({ status: "running" })
    .eq("id", generationId);

  try {
    const { data: product, error } = await db
      .from("products")
      .select("brand_brief, image_urls")
      .eq("id", productId)
      .single();
    if (error || !product?.brand_brief) throw new Error("Product not found.");

    const brief = product.brand_brief as BrandBrief;
    const referenceImageUrl = (product.image_urls as string[])[0] ?? null;
    const angles = await writeAdAngles(brief, ADS_PER_GENERATION);

    const tasks = angles.flatMap((ad, i) =>
      ASPECTS.map((aspect) => async () => {
        const imageUrl = await generateAdImage({
          prompt: ad.image_prompt,
          aspect,
          referenceImageUrl,
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

    // Refund the images that failed.
    const failed = results.length - creatives.length;
    if (failed > 0) {
      await db.rpc("refund_credits", {
        ws: workspaceId,
        amount: failed * CREDITS_PER_IMAGE,
      });
    }

    await db
      .from("generations")
      .update({
        status: "succeeded",
        prompt: angles.map((a) => a.image_prompt).join("\n"),
        error:
          failed > 0 ? `${failed} image(s) failed and were refunded.` : null,
      })
      .eq("id", generationId);
  } catch (err) {
    const message = userMessage(err, "Generation failed. Please try again.");
    console.error("generation failed", generationId, err);
    await db.rpc("refund_credits", {
      ws: workspaceId,
      amount: GENERATION_COST,
    });
    await db
      .from("generations")
      .update({ status: "failed", error: message })
      .eq("id", generationId);
  }
}

// Like Promise.allSettled, but runs at most `limit` tasks at a time.
async function settleWithLimit<T>(
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
