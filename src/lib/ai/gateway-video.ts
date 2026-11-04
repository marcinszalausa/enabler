// Seedance 2.0 through Vercel AI Gateway: ByteDance's own price with no
// markup (about half of fal's), billed on the Vercel account. Used only when
// AI_GATEWAY_API_KEY is set; fal stays the backup (see submitAdVideo in fal.ts).
// Docs: https://vercel.com/docs/ai-gateway/modalities/video-generation
import {
  experimental_getVideoStatus as getVideoStatus,
  experimental_startVideo as startVideo,
} from "ai";

export const GATEWAY_SEEDANCE = "bytedance/seedance-2.0";
const RESOLUTIONS: Record<string, `${number}x${number}`> = { "720p": "1280x720", "1080p": "1920x1080" };

export function gatewayKey(): string | null {
  return process.env.AI_GATEWAY_API_KEY?.trim() || null;
}

export function seedanceStartOptions(opts: { prompt: string; imageUrl: string; seconds: number; resolution: string }) {
  const resolution = RESOLUTIONS[opts.resolution];
  if (!resolution) throw new Error(`Unknown Seedance resolution ${opts.resolution}.`);
  return {
    model: GATEWAY_SEEDANCE,
    prompt: opts.prompt,
    frameImages: [{ image: opts.imageUrl, frameType: "first_frame" as const }],
    aspectRatio: "9:16" as const,
    resolution,
    duration: opts.seconds,
    // Sound is added later: a voiceover and a music bed.
    generateAudio: false,
  };
}

type Video = { type: "url"; url: string; mediaType: string } | { type: "base64"; data: string; mediaType: string } | { type: "binary"; data: Uint8Array; mediaType: string };
type Status = { status: "pending" } | { status: "completed"; videos: Video[] } | { status: "error"; error: string };

// A hosted URL, raw bytes to store, or null while the clip is being filmed.
export function gatewayVideoResult(status: Status): { url: string } | { bytes: Buffer; mediaType: string } | null {
  if (status.status === "pending") return null;
  if (status.status === "error") throw new Error(`The video model failed: ${status.error}`);
  const video = status.videos[0];
  if (!video) throw new Error("Video generation returned no video.");
  if (video.type === "url") return { url: video.url };
  return {
    bytes: video.type === "base64" ? Buffer.from(video.data, "base64") : Buffer.from(video.data),
    mediaType: video.mediaType || "video/mp4",
  };
}

// Returns the job's operation as JSON, to keep in the clip reference.
export async function submitGatewaySeedance(opts: Parameters<typeof seedanceStartOptions>[0]): Promise<string> {
  const { operation } = await startVideo(seedanceStartOptions(opts));
  return JSON.stringify(operation);
}

export async function getGatewaySeedance(operation: string) {
  return gatewayVideoResult((await getVideoStatus(GATEWAY_SEEDANCE, { operation: JSON.parse(operation) })) as Status);
}
