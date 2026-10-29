// Puts a video ad together with ffmpeg: the shots back to back, the hook
// headline, captions timed to the voiceover, a music bed and the end card.
// Imported only from server code; kept free of app imports so it can be
// tried on its own files.

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { ReactElement } from "react";
import ffmpegPath from "ffmpeg-static";
import { ImageResponse } from "next/og";
import { AD_SIZES } from "@/lib/ad-layout";
import { CaptionLayer, EndCardLayer, HookLayer } from "@/lib/video-layout";

const execFileAsync = promisify(execFile);

// Voiceover starts just after the first frame, so the shot hooks first.
const VOICE_START = 0.3;
const HOOK_END = 2.5;
const END_CARD_SECONDS = 1.5;
// A voiceover longer than the ad is sped up, but no more than this.
const MAX_TEMPO = 1.2;

export type VideoEdit = {
  clips: Buffer[];
  shotSeconds: number[];
  voice: Buffer;
  music: Buffer;
  voiceover: string;
  headline: string;
  cta: string;
  fontName: string;
  font: Buffer;
  accentColor: string;
  accentTextColor: string;
  logoUrl: string | null;
};

// Returns a 1080x1920 H.264/AAC MP4 with fast start, as Meta and TikTok
// expect.
export async function editVideoAd(edit: VideoEdit): Promise<Buffer> {
  if (!ffmpegPath) throw new Error("ffmpeg is not available here.");
  const total = edit.shotSeconds.reduce((a, b) => a + b, 0);
  const endCardStart = total - END_CARD_SECONDS;

  // Scratch files live in the OS temp folder; tell the bundler not to trace
  // these paths into the deployment.
  const dir = await mkdtemp(
    join(/*turbopackIgnore: true*/ tmpdir(), "gooidy-video-"),
  );
  const file = (name: string) => join(/*turbopackIgnore: true*/ dir, name);
  try {
    await writeFile(/*turbopackIgnore: true*/ file("voice.mp3"), edit.voice);
    const spoken = await mediaSeconds(file("voice.mp3"));
    const room = total - VOICE_START - 0.2;
    const tempo = Math.min(MAX_TEMPO, Math.max(1, spoken / room));
    const captions = timeCaptions(edit.voiceover, VOICE_START, spoken / tempo);

    const render = (layer: ReactElement) =>
      renderLayer(layer, edit.fontName, edit.font);
    const layers = await Promise.all([
      render(<HookLayer headline={edit.headline} fontFamily={edit.fontName} />),
      render(
        <EndCardLayer
          headline={edit.headline}
          cta={edit.cta}
          fontFamily={edit.fontName}
          accentColor={edit.accentColor}
          accentTextColor={edit.accentTextColor}
          logoUrl={edit.logoUrl}
        />,
      ),
      ...captions.map((c) =>
        render(<CaptionLayer text={c.text} fontFamily={edit.fontName} />),
      ),
    ]);

    await Promise.all([
      ...edit.clips.map((clip, i) =>
        writeFile(/*turbopackIgnore: true*/ file(`shot${i}.mp4`), clip),
      ),
      writeFile(/*turbopackIgnore: true*/ file("music.audio"), edit.music),
      ...layers.map((png, i) =>
        writeFile(/*turbopackIgnore: true*/ file(`layer${i}.png`), png),
      ),
    ]);

    const n = edit.clips.length;
    const voiceIn = n;
    const musicIn = n + 1;
    const layerIn = (i: number) => n + 2 + i;
    const args = ["-y"];
    edit.clips.forEach((_, i) => args.push("-i", file(`shot${i}.mp4`)));
    args.push("-i", file("voice.mp3"), "-i", file("music.audio"));
    // The hook and end card fade, so they run as 30 fps streams; captions
    // are single frames that overlay holds until it's told to stop.
    layers.forEach((_, i) =>
      args.push(
        ...(i < 2
          ? ["-loop", "1", "-framerate", "30", "-t", String(total)]
          : []),
        "-i",
        file(`layer${i}.png`),
      ),
    );

    const f: string[] = [];
    edit.shotSeconds.forEach((s, i) =>
      f.push(
        `[${i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,trim=duration=${s},setpts=PTS-STARTPTS[s${i}]`,
      ),
    );
    f.push(
      `${edit.shotSeconds.map((_, i) => `[s${i}]`).join("")}concat=n=${n}:v=1:a=0[v0]`,
    );
    f.push(
      `[${layerIn(0)}:v]format=rgba,fade=t=in:st=0.15:d=0.25:alpha=1,fade=t=out:st=${HOOK_END - 0.25}:d=0.25:alpha=1[hook]`,
      `[v0][hook]overlay=0:0:enable='lt(t,${HOOK_END})'[v1]`,
    );
    let last = "v1";
    captions.forEach((c, i) => {
      const next = `c${i}`;
      f.push(
        `[${last}][${layerIn(2 + i)}:v]overlay=0:0:enable='between(t,${c.start.toFixed(2)},${c.end.toFixed(2)})'[${next}]`,
      );
      last = next;
    });
    f.push(
      `[${layerIn(1)}:v]format=rgba,fade=t=in:st=${endCardStart}:d=0.3:alpha=1[end]`,
      `[${last}][end]overlay=0:0:enable='gte(t,${endCardStart})',fps=30,format=yuv420p[vout]`,
    );
    const delay = Math.round(VOICE_START * 1000);
    f.push(
      `[${voiceIn}:a]atempo=${tempo.toFixed(3)},adelay=${delay}:all=1[vo]`,
      `[${musicIn}:a]volume=0.14,afade=t=in:d=0.3,afade=t=out:st=${total - 1}:d=1[mu]`,
      `[vo][mu]amix=inputs=2:duration=longest:normalize=0,atrim=duration=${total}[aout]`,
    );

    args.push(
      "-filter_complex",
      f.join(";"),
      "-map",
      "[vout]",
      "-map",
      "[aout]",
      "-t",
      String(total),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      "-ac",
      "2",
      "-ar",
      "44100",
      "-movflags",
      "+faststart",
      file("out.mp4"),
    );
    await execFileAsync(ffmpegPath, args, {
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return await readFile(/*turbopackIgnore: true*/ file("out.mp4"));
  } finally {
    await rm(/*turbopackIgnore: true*/ dir, { recursive: true, force: true });
  }
}

type Caption = { text: string; start: number; end: number };

// Splits the voiceover into short phrases and spreads them over the time it
// is spoken, by length, with a beat for each pause. Close enough to read
// along; no word-level timing needed.
export function timeCaptions(
  text: string,
  start: number,
  seconds: number,
): Caption[] {
  const phrases: string[] = [];
  let current: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    current.push(word);
    const pause = /[,.!?;:]$/.test(word);
    if (
      current.length >= 4 ||
      current.join(" ").length >= 20 ||
      (pause && current.length >= 2)
    ) {
      phrases.push(current.join(" "));
      current = [];
    }
  }
  if (current.length) phrases.push(current.join(" "));

  const weight = (p: string) => p.length + (/[,.!?;:]$/.test(p) ? 4 : 0);
  const totalWeight = phrases.reduce((a, p) => a + weight(p), 0);
  let t = start;
  return phrases.map((p) => {
    const end = t + (weight(p) / totalWeight) * seconds;
    const caption = { text: p.replace(/[,;:]$/, ""), start: t, end };
    t = end;
    return caption;
  });
}

async function renderLayer(
  layer: ReactElement,
  fontName: string,
  font: Buffer,
) {
  const image = new ImageResponse(layer, {
    ...AD_SIZES["9:16"],
    fonts: [{ name: fontName, data: font, weight: 700, style: "normal" }],
  });
  return Buffer.from(await image.arrayBuffer());
}

// Length of an audio or video file, read from ffmpeg's report.
async function mediaSeconds(path: string): Promise<number> {
  const { stderr } = await execFileAsync(
    ffmpegPath!,
    ["-hide_banner", "-i", path, "-f", "null", "-"],
    { timeout: 30_000, maxBuffer: 10 * 1024 * 1024 },
  );
  const times = [...stderr.matchAll(/time=(\d+):(\d+):(\d+\.\d+)/g)];
  const match =
    times.at(-1) ?? stderr.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  if (!match) throw new Error("Couldn't read the voiceover length.");
  return +match[1] * 3600 + +match[2] * 60 + +match[3];
}
