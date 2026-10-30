import type { SupabaseClient } from "@supabase/supabase-js";

// Callback query parameters are untrusted, including accountId. Resolve an
// owned local account before any provider mutation, even when it is over limit.
export async function enforceConnectedAccountLimit(
  db: SupabaseClient,
  workspaceId: string,
  accountId: string,
  dependencies: {
    accountsInPlan: (workspaceId: string) => Promise<{ ids: string[] }>;
    disconnect: (accountId: string) => Promise<void>;
  },
): Promise<"allowed" | "removed" | "unowned"> {
  const { data: account, error } = await db.from("social_accounts")
    .select("id").eq("id", accountId).eq("workspace_id", workspaceId).maybeSingle();
  if (error) throw error;
  if (!account) return "unowned";
  const { ids } = await dependencies.accountsInPlan(workspaceId);
  if (ids.includes(account.id)) return "allowed";
  await dependencies.disconnect(account.id);
  const { error: deleteError } = await db.from("social_accounts").delete()
    .eq("id", account.id).eq("workspace_id", workspaceId);
  if (deleteError) throw deleteError;
  return "removed";
}
