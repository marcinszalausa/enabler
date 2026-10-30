import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { authorizeSocialCallback, socialConnectCookie, type SocialConnectContext } from "@/lib/social/oauth-state";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { accountsInPlan, syncAccounts } from "@/lib/social/publish";
import { deleteAccount } from "@/lib/social/zernio";
import { canEditWorkspace } from "@/lib/workspace-access";
import { enforceConnectedAccountLimit } from "@/lib/social/connection-limit";

function redirectResponse(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("cache-control", "no-store");
  response.headers.set("referrer-policy", "no-referrer");
  return response;
}

// Zernio sends the customer back here after they approve (or cancel) a
// network: ?connected=<platform>&profileId=...&accountId=...
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const back = new URL("/dashboard/publishing", request.nextUrl.origin);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return redirectResponse(new URL("/login", back));

  const cookie = socialConnectCookie(process.env.NODE_ENV === "production");
  const cookieStore = await cookies();
  let connection: SocialConnectContext | null;
  try {
    connection = await authorizeSocialCallback(params, cookieStore.get(cookie.name)?.value, auth.user.id,
      async (nonceHash, userId) => {
        const { data, error } = await createAdminClient().rpc("consume_social_connect_state", {
          p_nonce_hash: nonceHash, p_user_id: userId,
        }).abortSignal(AbortSignal.timeout(3500)).maybeSingle();
        if (error) throw error;
        return data as SocialConnectContext | null;
      });
  } catch {
    console.error("social callback state verification failed");
    back.searchParams.set("error", "connect");
    return redirectResponse(back);
  }
  if (!connection) {
    back.searchParams.set("error", "connect");
    back.searchParams.set("detail", "This connection attempt is invalid or expired. Please start again.");
    return redirectResponse(back);
  }
  cookieStore.set(cookie.name, "", { ...cookie.options, maxAge: 0 });

  const { data: profile } = await createAdminClient()
    .from("social_profiles")
    .select("workspace_id")
    .eq("zernio_profile_id", connection.profile_id)
    .eq("workspace_id", connection.workspace_id)
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
  if (!ws || !(await canEditWorkspace(supabase, ws.id)) || !platform || params.has("error")) {
    back.searchParams.set("error", "connect");
    // Zernio's own words on what went wrong, e.g. no Facebook Page ticked.
    const detail = params.get("error_message") ?? params.get("error");
    if (detail) back.searchParams.set("detail", detail.slice(0, 200));
    return redirectResponse(back);
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
        return redirectResponse(back);
      }
    }
  } catch (err) {
    console.error("account callback failed", err);
    back.searchParams.set("error", "connect");
    return redirectResponse(back);
  }
  back.searchParams.set("connected", platform);
  return redirectResponse(back);
}
