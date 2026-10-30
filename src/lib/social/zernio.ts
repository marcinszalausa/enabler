import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Zernio (formerly Late) posts to every network through its own approved
// platform apps, so customers connect accounts without Gooidy going through
// each network's app review. Docs: https://docs.zernio.com

const BASE = "https://zernio.com/api/v1";

export function zernioConfigured() {
  return Boolean(process.env.ZERNIO_API_KEY);
}

async function call<T>(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    query?: Record<string, string>;
  } = {},
): Promise<T> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(init.query ?? {})) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      authorization: `Bearer ${process.env.ZERNIO_API_KEY}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  // 207: published to some networks but not all; the body says which.
  if (!res.ok && res.status !== 207) {
    throw new ZernioError(
      res.status,
      data?.error ?? data?.message ?? `Zernio ${res.status}`,
    );
  }
  return data as T;
}

export class ZernioError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function createProfile(name: string) {
  const data = await call<{ profile?: { _id: string }; _id?: string }>(
    "/profiles",
    { method: "POST", body: { name } },
  );
  const id = data.profile?._id ?? data._id;
  if (!id) throw new Error("Zernio returned no profile id.");
  return id;
}

// Where to send the customer to log in to a network and approve posting.
// Zernio hosts the Page / organization / board picker, then comes back to
// redirectUrl with ?connected=<platform>&accountId=...
export async function connectUrl(
  platform: string,
  profileId: string,
  redirectUrl: string,
) {
  const data = await call<{ authUrl: string }>(`/connect/${platform}`, {
    query: {
      profileId,
      redirect_url: redirectUrl,
    },
  });
  return data.authUrl;
}

export type ZernioAccount = {
  _id: string;
  platform: string;
  username?: string;
  displayName?: string;
  profilePicture?: string;
  isActive?: boolean;
};

export async function listAccounts(profileId: string) {
  const data = await call<{ accounts?: ZernioAccount[] }>("/accounts", {
    query: { profileId },
  });
  return (data.accounts ?? []).filter((a) => a.isActive !== false);
}

export async function deleteAccount(accountId: string) {
  await call(`/accounts/${accountId}`, { method: "DELETE" });
}

// Uploads a file to Zernio's storage and returns its public address, which
// stays valid until the post goes out (our own links expire).
export async function uploadMedia(
  bytes: ArrayBuffer,
  contentType: string,
  filename: string,
) {
  const { uploadUrl, publicUrl } = await call<{
    uploadUrl: string;
    publicUrl: string;
  }>("/media/presign", {
    method: "POST",
    body: { filename, contentType, size: bytes.byteLength },
  });
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": contentType },
    body: bytes,
  });
  if (!put.ok) throw new Error(`Media upload failed (${put.status}).`);
  return publicUrl;
}

export type ZernioPlatformResult = {
  platform: string;
  accountId?: string | { _id: string };
  status?: string;
  publishedUrl?: string;
  platformPostUrl?: string;
  error?: string;
  errorMessage?: string;
};

export type ZernioPost = {
  _id?: string;
  id?: string;
  status: string;
  platforms?: ZernioPlatformResult[];
};

export type NewPost = {
  content: string;
  mediaItems: { type: "image" | "video"; url: string }[];
  platforms: {
    platform: string;
    accountId: string;
    customContent?: string;
    platformSpecificData?: Record<string, unknown>;
  }[];
  // Local wall-clock time ("2026-11-02T10:00:00") read in timeZone.
  scheduledFor?: string;
  timezone?: string;
  publishNow?: boolean;
  // Merged into every TikTok target; TikTok refuses posts without consent.
  tiktokSettings?: Record<string, unknown>;
  metadata?: Record<string, string>;
};

export async function createPost(post: NewPost, idempotencyKey: string) {
  const res = await fetch(`${BASE}/posts`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.ZERNIO_API_KEY}`,
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify(post),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 207) {
    throw new ZernioError(
      res.status,
      data?.error ?? data?.message ?? `Zernio ${res.status}`,
    );
  }
  return (data.post ?? data) as ZernioPost;
}

export async function getPost(postId: string) {
  const data = await call<{ post?: ZernioPost } & ZernioPost>(
    `/posts/${postId}`,
  );
  return data.post ?? data;
}

export async function deletePost(postId: string) {
  await call(`/posts/${postId}`, { method: "DELETE" });
}

// Webhook bodies are signed: lowercase hex HMAC-SHA256 of the raw body.
export function validSignature(rawBody: string, header: string | null) {
  const secret = process.env.ZERNIO_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}
