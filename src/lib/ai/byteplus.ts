// Seedance 2.0 straight from ByteDance's BytePlus ModelArk, at about half
// of fal's price for the same model. Used only when BYTEPLUS_API_KEY is set;
// fal stays the backup (see submitAdVideo in fal.ts).
// Docs: https://ai.byteplus.com/ark/region:ap-southeast-1/docs/create-video-generation-task-api

const BASE_URL = "https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks";
export const SEEDANCE_MODEL_ID = "dreamina-seedance-2-0-260128";

export function byteplusKey(): string | null {
  return process.env.BYTEPLUS_API_KEY?.trim() || null;
}

export function seedanceTaskBody(opts: {
  prompt: string;
  imageUrl: string;
  seconds: number;
  resolution: string;
}) {
  return {
    model: SEEDANCE_MODEL_ID,
    content: [
      { type: "text", text: opts.prompt },
      { type: "image_url", image_url: { url: opts.imageUrl }, role: "first_frame" },
    ],
    resolution: opts.resolution,
    ratio: "9:16",
    duration: opts.seconds,
    // Sound is added later: a voiceover and a music bed.
    generate_audio: false,
    watermark: false,
  };
}

type Task = {
  status?: string;
  content?: { video_url?: string };
  error?: { code?: string; message?: string } | null;
};

// The finished clip's URL, null while the task is still queued or running.
export function seedanceTaskResult(task: Task): string | null {
  if (task.status === "succeeded") {
    const url = task.content?.video_url;
    if (!url) throw new Error("Video generation returned no video.");
    return url;
  }
  if (task.status === "failed" || task.status === "expired") {
    throw new Error(`The video model failed: ${task.error?.message ?? task.status}`);
  }
  return null;
}

async function call(path: string, init: RequestInit, key: string, attempt = 1): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    await new Promise((r) => setTimeout(r, 2000 * attempt));
    return call(path, init, key, attempt + 1);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("BytePlus API error", res.status, JSON.stringify(body));
    const message = (body as Task).error?.message;
    throw new Error(`BytePlus returned ${res.status}${message ? `: ${message}` : ""}`);
  }
  return body;
}

export async function submitSeedance(opts: Parameters<typeof seedanceTaskBody>[0], key: string): Promise<string> {
  const body = (await call("", { method: "POST", body: JSON.stringify(seedanceTaskBody(opts)) }, key)) as { id?: string };
  if (!body.id) throw new Error("BytePlus returned no task id.");
  return body.id;
}

export async function getSeedance(taskId: string): Promise<string | null> {
  const key = byteplusKey();
  if (!key) throw new Error("A BytePlus video is waiting but BYTEPLUS_API_KEY is not set.");
  return seedanceTaskResult((await call(`/${encodeURIComponent(taskId)}`, { method: "GET" }, key)) as Task);
}
