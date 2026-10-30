import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { accountsInPlan, syncAccounts } from "@/lib/social/publish";
import { deleteAccount } from "@/lib/social/zernio";

// Zernio sends the customer back here after they approve (or cancel) a
// network: ?connected=<platform>&profileId=...&accountId=...
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const back = new URL("/dashboard/publishing", request.nextUrl.origin);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(new URL("/login", back));

  const { data: profile } = await createAdminClient()
    .from("social_profiles")
    .select("workspace_id")
    .eq("zernio_profile_id", params.get("profileId") ?? "")
    .maybeSingle();
  // RLS: the caller must be a member of that workspace.
  const { data: ws } = profile
    ? await supabase
        .from("workspaces")
        .select("id")
        .eq("id", profile.workspace_id)
        .maybeSingle()
    : { data: null };

  const platform = params.get("connected");
  if (!ws || !platform || params.get("error")) {
    back.searchParams.set("error", "connect");
    return NextResponse.redirect(back);
  }
  try {
    await syncAccounts(ws.id);
  } catch (err) {
    console.error("account sync failed", err);
  }

  // Over the plan's limit (e.g. two tabs connecting at once): undo this one.
  const accountId = params.get("accountId");
  const { ids } = await accountsInPlan(ws.id);
  if (accountId && !ids.includes(accountId)) {
    try {
      await deleteAccount(accountId);
    } catch (err) {
      console.error("over-limit disconnect failed", accountId, err);
    }
    await createAdminClient()
      .from("social_accounts")
      .delete()
      .eq("id", accountId);
    back.searchParams.set("error", "limit");
    return NextResponse.redirect(back);
  }
  back.searchParams.set("connected", platform);
  return NextResponse.redirect(back);
}
