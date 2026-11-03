import type { createAdminClient } from "@/lib/supabase/admin";
type Db = ReturnType<typeof createAdminClient>;

// Only the worker that transitions queued -> running may call AI providers.
export async function claimGeneration(db: Db, generationId: string) {
  const { data, error } = await db.from("generations")
    .update({ status: "running" })
    .eq("id", generationId).eq("status", "queued").select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function finalizeGeneration(
  db: Db,
  generationId: string,
  status: "succeeded" | "failed",
  refund: number,
  failure: string | null,
  prompt: string | null = null,
) {
  const { data, error } = await db.rpc("finalize_generation", {
    generation_id: generationId, final_status: status, refund,
    failure_message: failure, output_prompt: prompt,
  });
  // A failed/ambiguous settlement must remain retryable. Never silently report
  // success, or fall back to a second full refund after a partial outcome.
  if (error) throw error;
  if (typeof data !== "boolean") throw new Error("Missing settlement receipt.");
  return data;
}
