import "server-only";
import { UserError } from "@/lib/errors";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { ScrapedPage } from "@/lib/scrape";

const MODEL = "claude-opus-5-5";
// Server-side fallback: if a request is declined by a safety classifier,
// the API retries it on Anthropic's recommended model for that category.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

const client = new Anthropic();

export const BrandBriefSchema = z.object({
  product_name: z.string().describe("Short product or business name"),
  summary: z.string().describe("One or two sentences on what is sold"),
  audience: z.string().describe("Who buys this, in one sentence"),
  pain_points: z.array(z.string()).describe("Three problems the buyer has"),
  benefits: z.array(z.string()).describe("Three concrete benefits"),
  tone: z.string().describe("Brand voice in a few words, e.g. 'warm, playful'"),
  visual_style: z
    .string()
    .describe("Look and feel for imagery: setting, colors, mood"),
  price: z.string().nullable(),
});
export type BrandBrief = z.infer<typeof BrandBriefSchema>;

export const AdAngleSchema = z.object({
  angle: z.enum(["pain", "benefit", "social_proof", "offer", "curiosity"]),
  headline: z.string().describe("Max 40 characters"),
  primary_text: z.string().describe("Max 125 characters, the ad body"),
  cta: z.string().describe("2-3 words, e.g. 'Shop now'"),
  image_prompt: z
    .string()
    .describe(
      "Scene for the ad image, featuring the product. Describe setting, lighting, composition. Show the product once, in its real color and design; no second person or before/after split wearing or holding a different version. No text, words or logos in the image.",
    ),
});
export type AdAngle = z.infer<typeof AdAngleSchema>;

const AdAnglesSchema = z.object({ ads: z.array(AdAngleSchema) });

// Turns API failures into messages that point at the likely fix.
// The full error still goes to the server log.
async function callClaude<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error("Claude API error", err.status, err.message);
      if (err.status === 401 || err.status === 403) {
        throw new UserError(
          "The AI service rejected our API key. Check ANTHROPIC_API_KEY.",
        );
      }
      if (err.status === 400 && /credit balance/i.test(err.message)) {
        throw new UserError("The AI account is out of credits.");
      }
      if (
        err.status === 429 ||
        err.status === 529 ||
        (err.status ?? 0) >= 500
      ) {
        throw new UserError(
          "The AI service is busy right now. Please try again in a minute.",
        );
      }
      throw new UserError(
        `The AI service returned an error (${err.status ?? "network"}).`,
      );
    }
    if (err instanceof Error && /authentication method/i.test(err.message)) {
      throw new UserError(
        "The AI service has no API key. Check ANTHROPIC_API_KEY.",
      );
    }
    throw err;
  }
}

function assertAnswered(stopReason: string | null) {
  if (stopReason === "refusal") {
    throw new UserError("The AI declined to work on this page.");
  }
  if (stopReason === "max_tokens") {
    throw new UserError("The AI response was cut off. Please try again.");
  }
}

export async function extractBrandBrief(
  page: ScrapedPage,
): Promise<BrandBrief> {
  const response = await callClaude(() =>
    client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: {
        effort: "low",
        format: betaZodOutputFormat(BrandBriefSchema),
      },
      system:
        "You are a performance-marketing strategist for small businesses. Read a scraped product or business web page and write a concise brand brief for ad creation. Use only facts the page supports; when something isn't stated, infer it sensibly from the product category.",
      messages: [
        {
          role: "user",
          content: [
            `URL: ${page.url}`,
            `Title: ${page.title ?? "(none)"}`,
            `Description: ${page.description ?? "(none)"}`,
            `Price: ${page.price ?? "(unknown)"}`,
            "",
            "Page text:",
            page.text,
          ].join("\n"),
        },
      ],
    }),
  );
  assertAnswered(response.stop_reason);
  if (!response.parsed_output)
    throw new UserError("Couldn't read the brand brief.");
  return response.parsed_output;
}

export async function writeAdAngles(
  brief: BrandBrief,
  count = 5,
): Promise<AdAngle[]> {
  const response = await callClaude(() =>
    client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: {
        effort: "medium",
        format: betaZodOutputFormat(AdAnglesSchema),
      },
      system:
        "You write high-converting Meta and TikTok ads for small and medium businesses. Each ad uses a different angle. Headlines are punchy and at most 40 characters; primary text is at most 125 characters; no hashtags, no emoji, no false claims or invented reviews. Match the brand's tone.",
      messages: [
        {
          role: "user",
          content: `Write ${count} ads, one per angle (pain, benefit, social_proof, offer, curiosity), for this brand brief:\n\n${JSON.stringify(brief, null, 2)}`,
        },
      ],
    }),
  );
  assertAnswered(response.stop_reason);
  const ads = response.parsed_output?.ads;
  if (!ads?.length) throw new UserError("Couldn't write ad copy.");
  return ads.slice(0, count);
}
