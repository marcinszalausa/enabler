import type { SupabaseClient } from "@supabase/supabase-js";

export const WORKSPACE_WRITE_DENIED = "You need editor access to change this workspace.";

// Must receive the authenticated user's client, never the service-role client.
// The existing database helper checks auth.uid() and owner/editor membership.
export async function canEditWorkspace(client: SupabaseClient, workspaceId: string) {
  const { data, error } = await client.rpc("is_workspace_member", {
    ws: workspaceId, min_role: "editor",
  });
  return !error && data === true;
}
