import { createAdminClient } from "@/lib/supabase/admin";

// Daily (vercel.json): yearly plans are paid once a year, but their credits
// arrive month by month, with the same one-month rollover as monthly plans.
// Vercel sends CRON_SECRET as a bearer token.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { data, error } = await createAdminClient().rpc(
    "grant_due_yearly_credits",
  );
  if (error) {
    console.error("grant_due_yearly_credits failed", error);
    return new Response("Failed", { status: 500 });
  }
  return Response.json(
    { granted: data ?? 0 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
