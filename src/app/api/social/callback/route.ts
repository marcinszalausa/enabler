import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { accountsInPlan, syncAccounts } from "@/lib/social/publish";
import { deleteAccount } from "@/lib/social/zernio";
import { canEditWorkspace } from "@/lib/workspace-access";
import { enforceConnectedAccountLimit } from "@/lib/social/connection-limit";

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
  if (!ws || !(await canEditWorkspace(supabase, ws.id)) || !platform || params.get("error")) {
    back.searchParams.set("error", "connect");
    // Zernio's own words on what went wrong, e.g. no Facebook Page ticked.
    const detail = params.get("error_message") ?? params.get("error");
    if (detail) back.searchParams.set("detail", detail.slice(0, 200));
    return NextResponse.redirect(back);
  }
  try {
    // Do not perform limit enforcement if synchronization failed.
    await syncAccounts(ws.id);
    const accountId = params.get("accountId");
    if (accountId) {
      const result = await enforceConnectedAccountLimit(createAdminClient(), ws.id, accountId, {
        accountsInPlan,
        disconnect: deleteAccount,
      });
      if (result !== "allowed") {
        back.searchParams.set("error", result === "removed" ? "limit" : "connect");
        return NextResponse.redirect(back);
      }
    }
  } catch (err) {
    console.error("account callback failed", err);
    back.searchParams.set("error", "connect");
    return NextResponse.redirect(back);
  }
  back.searchParams.set("connected", platform);
  return NextResponse.redirect(back);
}
