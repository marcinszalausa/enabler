import { createClient } from "@/lib/supabase/server";
import { advanceVideoGeneration } from "@/lib/video";
import { canEditWorkspace } from "@/lib/workspace-access";

// Adding text to a finished clip and saving it takes a few seconds per video.
export const maxDuration = 300;

// Collects any clips the video model has finished for this run.
export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/generations/[id]/advance">,
) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  // RLS: returns the run only for members of its workspace.
  const { data: generation } = await supabase
    .from("generations")
    .select("id, workspace_id")
    .eq("id", id)
    .maybeSingle();
  if (!generation) return new Response("Not found", { status: 404 });
  if (!(await canEditWorkspace(supabase, generation.workspace_id))) {
    return new Response("Editor access required", { status: 403 });
  }

  await advanceVideoGeneration(id);
  return new Response(null, { status: 204 });
}
