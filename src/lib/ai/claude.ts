import "server-only";
import { UserError } from "@/lib/errors";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { ScrapedPage } from "@/lib/scrape";
import {
  ACCENTS,
  ENERGIES,
  GENDERS,
  LANGUAGES,
  PEOPLE,
  isEnglish,
  type VideoOptions,
} from "@/lib/video-options";

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
      "Scene for the ad image, featuring the product. Describe setting, lighting, composition. Show the product once, in its real color and design; no second person or before/after split wearing or holding a different version. Keep hands simple and natural: relaxed at the sides, in pockets or holding one large object; avoid crossed arms, interlaced fingers and close-ups of hands. No text, words or logos in the image.",
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

const ShotSchema = z.object({
  image_prompt: z
    .string()
    .describe(
      "The first frame of this shot. Shot 1 sets the scene: one person wearing or using the product, setting, lighting, framing. Later shots must say they keep the same person, outfit and setting from shot 1 and change only the framing (e.g. close-up of the fabric at the cuff, waist-up from a new angle). Show the product once, in its real color and design. Keep hands simple and natural, or out of frame. No text, words or logos.",
    ),
  motion_prompt: z
    .string()
    .describe(
      "What happens in the 3- to 4-second clip that starts from that frame: one simple, natural motion (a slow turn, fabric moving as the person walks, a hand smoothing the sleeve) plus one smooth camera move (slow push-in, gentle pan). Realistic physics; the product keeps its exact look. No text, no cuts, no new people.",
    ),
});

export const VideoAdSchema = AdAngleSchema.omit({ image_prompt: true }).extend({
  headline: z
    .string()
    .describe(
      "Max 32 characters; the hook shown over the first seconds and on the end card",
    ),
  voiceover: z
    .string()
    .describe(
      "What a narrator says over the whole ad: 12 to 16 words, about 5 seconds spoken. The first sentence is the hook; the last is the call to action. Natural spoken English, no lists, no symbols or abbreviations, no prices unless the brief states them.",
    ),
  music_prompt: z
    .string()
    .describe(
      "Instrumental background music for the ad: genre, mood, tempo, instruments, e.g. 'warm lo-fi acoustic guitar, soft beat, 90 bpm'. No vocals.",
    ),
  shots: z.array(ShotSchema).describe("Exactly 2 shots, in order"),
});
export type VideoAd = z.infer<typeof VideoAdSchema>;

const VideoAdsSchema = z.object({ ads: z.array(VideoAdSchema) });

export async function writeVideoAds(
  brief: BrandBrief,
  count: number,
  shotSeconds: number[],
  options: VideoOptions,
): Promise<VideoAd[]> {
  const shots = shotSeconds.length;
  const seconds = shotSeconds.reduce((a, b) => a + b, 0);
  const person = PEOPLE[options.person].direction;
  const direction = [
    `Energy: ${ENERGIES[options.energy].direction}. Let it shape the words, the pace of the motion and the music.`,
    isEnglish(options)
      ? `Narrator: ${GENDERS[options.gender].label.toLowerCase()}, speaking English with a${/^[AEIOU]/.test(ACCENTS[options.accent].label) ? "n" : ""} ${ACCENTS[options.accent].label} accent. Write the voiceover in English.`
      : `Language: ${LANGUAGES[options.language].label}. Write the headline, primary text, call to action and voiceover in natural, native ${LANGUAGES[options.language].label} (not a literal translation). Keep the image and motion prompts in English. Narrator: ${GENDERS[options.gender].label.toLowerCase()}.`,
    person
      ? `On screen: ${person}, in every shot.`
      : "On screen: one person who fits the audience, the same in every shot.",
    options.message &&
      `The owner wants the voiceover to say this; keep their wording where it fits the length, and build every ad around it:\n<owner_message>\n${options.message}\n</owner_message>`,
  ]
    .filter(Boolean)
    .join("\n");
  const response = await callClaude(() =>
    client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: {
        effort: "medium",
        format: betaZodOutputFormat(VideoAdsSchema),
      },
      system: `You write short vertical video ads for Instagram Reels, Facebook Reels and TikTok for small and medium businesses. Each ad runs ${seconds} seconds: ${shots} shots (${shotSeconds.join(" and ")} seconds) with the same person in the same setting, a narrator's voiceover with captions, quiet background music, and an end card with the headline and call to action over the last moments. The first second must stop the scroll. Each ad uses a different angle. Headlines are punchy and at most 32 characters; primary text (the post caption) is at most 125 characters; no hashtags, no emoji, no false claims or invented reviews. Match the brand's tone. Motion must be simple enough for an AI video model to render realistically.`,
      messages: [
        {
          role: "user",
          content: `Write ${count} video ads, each with a different angle (choose the strongest of pain, benefit, social_proof, offer, curiosity) and exactly ${shots} shots, for this brand brief:\n\n${JSON.stringify(brief, null, 2)}\n\nCreative direction:\n${direction}`,
        },
      ],
    }),
  );
  assertAnswered(response.stop_reason);
  const ads = response.parsed_output?.ads.filter(
    (ad) => ad.shots.length >= shots,
  );
  if (!ads?.length) throw new UserError("Couldn't write video scripts.");
  return ads
    .slice(0, count)
    .map((ad) => ({ ...ad, shots: ad.shots.slice(0, shots) }));
}

const ImageReviewSchema = z.object({
  ok: z
    .boolean()
    .describe("True only if the image could run as a paid ad as is"),
  issues: z
    .string()
    .describe("Short list of the visible defects; empty when ok"),
});
export type ImageReview = z.infer<typeof ImageReviewSchema>;

// Checks a generated ad photo for the flaws image models make: broken
// hands, warped faces, and a product that doesn't match the real one.
export async function reviewAdImage(opts: {
  imageUrl: string;
  referenceImageUrl: string | null;
  product: string;
}): Promise<ImageReview> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (opts.referenceImageUrl) {
    content.push(
      { type: "text", text: "The real product photo:" },
      { type: "image", source: { type: "url", url: opts.referenceImageUrl } },
    );
  }
  content.push(
    { type: "text", text: "The generated ad photo to check:" },
    { type: "image", source: { type: "url", url: opts.imageUrl } },
    {
      type: "text",
      text: `Product: ${opts.product}. Check the generated photo closely. Reject it for any of: hands or fingers that are malformed, merged, extra or missing; distorted faces, eyes or limbs; garbled text or logos; the product shown in a different color, pattern or design than the real one; a second, different version of the product. Differences in pose, setting, lighting or slight shade from the lighting are fine; only reject flaws a shopper would actually notice.`,
    },
  );

  const response = await callClaude(() =>
    client.beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: {
        effort: "low",
        format: betaZodOutputFormat(ImageReviewSchema),
      },
      system:
        "You are a strict quality checker for advertising photos. A real brand will pay to show this image, so reject anything a shopper would notice as wrong.",
      messages: [{ role: "user", content }],
    }),
  );
  assertAnswered(response.stop_reason);
  if (!response.parsed_output)
    throw new Error("Image review returned no verdict.");
  return response.parsed_output;
}
