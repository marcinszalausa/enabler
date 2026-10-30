import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validSignature, type ZernioPost } from "@/lib/social/zernio";
import { applyZernioPost } from "@/lib/social/publish";

// Zernio tells us when a post goes out or fails, and when a customer's
// account disconnects (e.g. they changed their password). Set it up in
// Zernio > Webhooks with ZERNIO_WEBHOOK_SECRET as the secret.
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("x-zernio-signature"))) {
    return new Response("Bad signature", { status: 401 });
  }
  const body = JSON.parse(raw) as {
    event?: string;
    post?: ZernioPost;
    account?: { accountId?: string };
  };
  const db = createAdminClient();

  if (body.event?.startsWith("post.") && body.post) {
    const zernioId = body.post.id ?? body.post._id;
    const { data: post } = await db
      .from("posts")
      .select("id")
      .eq("zernio_post_id", zernioId ?? "")
      .maybeSingle();
    if (post) await applyZernioPost(db, post.id, body.post);
  } else if (body.event === "account.disconnected" && body.account?.accountId) {
    await db.from("social_accounts").delete().eq("id", body.account.accountId);
  }
  return new Response("ok");
}
