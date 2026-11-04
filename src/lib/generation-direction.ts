import "server-only";
import {revisionFromOptions,revisionCampaign} from "@/lib/creative-revision";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseBrandMemory, parseCampaign } from "@/lib/customer-workflow";

// Read the reserved snapshot, not today's mutable brand settings.
export async function generationDirection(db: SupabaseClient, generationId: string, workspaceId: string) {
  const { data, error } = await db.from("generations").select("request_options").eq("id", generationId).eq("workspace_id", workspaceId).single();
  if (error || !data) throw error ?? new Error("Generation settings unavailable.");
  const options = data.request_options as Record<string, unknown> | null;
  const revision=revisionFromOptions(options);
  return { revision, brand_memory: parseBrandMemory(options?.brand_memory), campaign: revision?revisionCampaign(revision):parseCampaign(options?.campaign) };
}
