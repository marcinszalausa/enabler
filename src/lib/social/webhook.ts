import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const id = z.string().min(1).max(256);
const text = z.string().max(16384);
const envelope = z.object({
  id: z.uuid(),
  event: z.string().min(1).max(128),
  timestamp: z.iso.datetime({ offset: true }),
  test: z.boolean().optional(),
});
const platform = z.object({
  platform: z.string().min(1).max(128),
  status: z.string().min(1).max(128),
  accountId: id.nullish(),
  publishedUrl: text.nullish(),
  error: text.nullish(),
});
const post = z.object({
  id,
  status: z.enum(["draft", "pending", "scheduled", "publishing", "published", "partial", "failed", "cancelled"]),
  platforms: z.array(platform).max(100),
});
const account = z.object({ accountId: id, profileId: id });
const postEvents = new Set([
  "post.scheduled", "post.published", "post.partial", "post.failed",
  "post.cancelled", "post.platform.published", "post.platform.failed",
  "post.platform.deleted", "post.tiktok.url_resolved",
]);

export type WebhookOperation = {
  event_id: string;
  body_hash: string;
  event_name: string;
  event_time: string;
  target_id: string;
  post_status: string | null;
  post_results: { platform: string; account_id: string | null; status: string; url: string | null; error: string | null }[];
  profile_id: string | null;
};

export function validWebhookSignature(raw: string | Uint8Array, signature: string | null, secret?: string) {
  if (!secret || !signature || !/^[0-9a-f]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

export const MAX_WEBHOOK_BYTES = 1024 * 1024;

async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_WEBHOOK_BYTES) {
        // Do not wait for an attacker-controlled stream to finish cancelling.
        void reader.cancel().catch(() => {});
        throw new RangeError("Webhook too large");
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally {
    reader.releaseLock();
  }
}

export async function handleZernioWebhook(
  request: Request,
  dependencies: {
    secret?: string;
    apply: (operation: WebhookOperation) => Promise<boolean>;
    report?: (details: { eventId: string; event: string; code: string }) => void;
  },
) {
  if (!dependencies.secret) return new Response("Webhook unavailable", { status: 503 });
  const signature = request.headers.get("x-zernio-signature") ?? request.headers.get("x-late-signature");
  if (!signature || !/^[0-9a-f]{64}$/.test(signature)) return new Response("Bad signature", { status: 401 });
  let raw: Uint8Array;
  try {
    raw = await readBody(request);
  } catch (error) {
    return new Response("Invalid body", { status: error instanceof RangeError ? 413 : 400 });
  }
  if (!validWebhookSignature(raw, signature, dependencies.secret)) {
    return new Response("Bad signature", { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  } catch {
    return new Response("Malformed JSON", { status: 400 });
  }
  const parsed = envelope.safeParse(body);
  if (!parsed.success) return new Response("Invalid event", { status: 400 });
  const event = parsed.data;
  const headerId = request.headers.get("x-zernio-event-id") ?? request.headers.get("x-late-event-id");
  if (headerId && headerId !== event.id) return new Response("Event ID mismatch", { status: 400 });

  // Test payloads use placeholder resource IDs; never mutate real records.
  if (event.test || event.event === "webhook.test") return new Response("ok");
  const operation: WebhookOperation = {
    event_id: event.id, event_name: event.event, event_time: event.timestamp,
    body_hash: createHash("sha256").update(raw).digest("hex"),
    target_id: "", post_status: null, post_results: [], profile_id: null,
  };
  if (postEvents.has(event.event)) {
    const result = z.object({ post }).safeParse(body);
    if (!result.success) return new Response("Invalid post event", { status: 400 });
    operation.target_id = result.data.post.id;
    operation.post_status = ["draft", "pending"].includes(result.data.post.status)
      ? "scheduled" : result.data.post.status;
    operation.post_results = result.data.post.platforms.map((p) => ({
      platform: p.platform, account_id: p.accountId ?? null,
      status: p.status, url: p.publishedUrl ?? null, error: p.error ?? null,
    }));
  } else if (event.event === "account.disconnected") {
    const result = z.object({ account }).safeParse(body);
    if (!result.success) return new Response("Invalid account event", { status: 400 });
    operation.target_id = result.data.account.accountId;
    operation.profile_id = result.data.account.profileId;
  } else {
    // External/recycled posts have no local record. Ignore unsubscribed families.
    return new Response("ignored");
  }
  try {
    const receipt = await dependencies.apply(operation);
    if (typeof receipt !== "boolean") throw new Error("Missing receipt");
    return new Response("ok");
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      && typeof error.code === "string" && /^[A-Z0-9]{5}$/.test(error.code)
      ? error.code : "ERROR";
    dependencies.report?.({ eventId: event.id, event: event.event, code });
    return new Response("Try again", { status: 503, headers: { "Retry-After": "10" } });
  }
}
