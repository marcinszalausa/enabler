import { createAdminClient } from "@/lib/supabase/admin";
import { handleZernioWebhook } from "@/lib/social/webhook";

export async function POST(request: Request) {
  return handleZernioWebhook(request, {
    secret: process.env.ZERNIO_WEBHOOK_SECRET,
    apply: async (operation) => {
      const { data, error } = await createAdminClient().rpc("apply_zernio_webhook", operation)
        .abortSignal(AbortSignal.timeout(3500));
      if (error) throw error;
      if (typeof data !== "boolean") throw new Error("Missing webhook receipt");
      return data;
    },
    report: (details) => console.error("zernio webhook processing failed", details),
  });
}
