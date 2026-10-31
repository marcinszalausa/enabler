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
import {chooseOverlays,chooseCaption,type Rect} from "@/lib/face-safe-layout";
import {analyzeShotFaces,VIDEO_CROP} from "@/lib/video-face-analysis";
import { AD_SIZES, adTextStyles } from "@/lib/ad-layout";
import { fontsFor, isRtl, prepareText } from "@/lib/ad-text";
import {
  CaptionLayer,
  EndCardLayer,
  HookLayer,
  VIDEO_TEXT_STYLES,
} from "@/lib/video-layout";

const execFileAsync = promisify(execFile);

// Voiceover starts just after the first frame, so the shot hooks first.
const VOICE_START = 0.3;
const HOOK_END = 2.5;
// Longer ads hold the end card longer.
const endCardSeconds = (total: number) => (total >= 15 ? 2.5 : 1.5);
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
  const endCardStart = Math.max(0,total - endCardSeconds(total));
  const hookDuration=Math.min(HOOK_END,endCardStart);

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
    await Promise.all(edit.clips.map((clip,i)=>writeFile(/*turbopackIgnore: true*/ file(`shot${i}.mp4`),clip)));
    const deadline=performance.now()+120000;
    const shotFaces:Array<Rect[]|null>=[];for(let i=0;i<edit.clips.length;i++)shotFaces.push(await analyzeShotFaces(file(`shot${i}.mp4`),edit.shotSeconds[i],deadline));
    // A short or incomplete clip can shift later cut times. Fail closed for
    // the entire edit instead of trusting partially analyzed timing.
    if(shotFaces.some(faces=>faces===null))shotFaces.fill(null);
    const captionRegions=shotFaces.map(faces=>chooseCaption("9:16",faces));
    let spanStart=0;
    const spans=edit.shotSeconds.map(seconds=>{const start=spanStart;spanStart+=seconds;return {start,end:spanStart};});
    const touched=(start:number,end:number)=>spans.flatMap((s,i)=>s.start<end&&s.end>start?[i]:[]);
    const collect=(indices:number[]):Rect[]|null=>indices.some(i=>shotFaces[i]===null)?null:indices.flatMap(i=>shotFaces[i]??[]);
    const hookShots=touched(0,hookDuration),endShots=touched(endCardStart,total);
    const blockers=(indices:number[])=>indices.flatMap(i=>captionRegions[i]?[captionRegions[i]!]:[]);
    const hookPlan=chooseOverlays("9:16",collect(hookShots),{headline:!!edit.headline},blockers(hookShots));
    const endPlan=chooseOverlays("9:16",collect(endShots),{headline:!!edit.headline,cta:edit.cta,logo:!!edit.logoUrl},blockers(endShots));
    let shotStart=0;
    const captionSegments=edit.shotSeconds.flatMap((seconds,i)=>{
     const begin=shotStart;shotStart+=seconds;
     return captions.filter(c=>c.start<shotStart&&c.end>begin).map(c=>({...c,start:Math.max(begin,c.start),end:Math.min(shotStart,c.end),region:captionRegions[i]}));
    });

    // Copy in scripts Satori can't shape arrives as images (see ad-text).
    const brand = { name: edit.fontName, data: edit.font };
    const card = adTextStyles("9:16", edit.accentTextColor,endPlan);
    const hookStyle={...VIDEO_TEXT_STYLES.hook,fontSize:hookPlan.headline?.fontSize??72,maxWidth:hookPlan.headline?.width??936};
    const rtl = isRtl([edit.headline, edit.cta]);
    const [fonts, hook, headline, cta, ...captionTexts] = await Promise.all([
      fontsFor([edit.headline, edit.cta, edit.voiceover]),
      prepareText(hookPlan.headline?edit.headline:"", hookStyle, brand),
      prepareText(edit.headline, card.headline, brand),
      prepareText(edit.cta, card.cta, brand),
      ...captionSegments.map((c) =>
        prepareText(c.text, VIDEO_TEXT_STYLES.caption, brand),
      ),
    ]);
    const render = (layer: ReactElement) =>
      renderLayer(layer, [
        { name: edit.fontName, data: edit.font, weight: 700, style: "normal" },
        ...fonts,
      ]);
    const layers = await Promise.all([
      render(
        <HookLayer headline={hook} fontFamily={edit.fontName} rtl={rtl} region={hookPlan.headline}/>,
      ),
      render(
        <EndCardLayer
          headline={headline}
          placement={endPlan}
          cta={cta}
          rtl={rtl}
          fontFamily={edit.fontName}
          accentColor={edit.accentColor}
          accentTextColor={edit.accentTextColor}
          logoUrl={edit.logoUrl}
        />,
      ),
      ...captionTexts.map((text,i) =>
        render(<CaptionLayer text={text} fontFamily={edit.fontName} region={captionSegments[i].region}/>),
      ),
    ]);

    await Promise.all([
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
    // Hook and closing copy fade over full-frame footage in selected safe areas; captions
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
        `[${i}:v]${VIDEO_CROP},trim=duration=${s},setpts=PTS-STARTPTS[s${i}]`,
      ),
    );
    f.push(
      `${edit.shotSeconds.map((_, i) => `[s${i}]`).join("")}concat=n=${n}:v=1:a=0[v0]`,
    );
    f.push(
      `[${layerIn(0)}:v]format=rgba,fade=t=in:st=0.15:d=0.25:alpha=1,fade=t=out:st=${Math.max(.15,hookDuration - .25)}:d=0.25:alpha=1[hook]`,
      `[v0][hook]overlay=0:0:enable='lt(t,${hookDuration})'[v1]`,
    );
    let last = "v1";
    captionSegments.forEach((c, i) => {
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
    // Delay before the tempo change: atempo followed by adelay ends the
    // stream early. The delay is scaled so it lands at VOICE_START.
    const delay = Math.round(VOICE_START * 1000 * tempo);
    f.push(
      `[${voiceIn}:a]adelay=${delay}:all=1,atempo=${tempo.toFixed(3)}[vo]`,
      `[${musicIn}:a]volume=0.14,afade=t=in:d=0.3,afade=t=out:st=${total - 1}:d=1[mu]`,
      `[vo][mu]amix=inputs=2:duration=longest:normalize=0,atrim=duration=${total},loudnorm=I=-14:TP=-1.5:LRA=11[aout]`,
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
      // A 30-second ad has many shots and captions to lay over each other.
      timeout: 240_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return await readFile(/*turbopackIgnore: true*/ file("out.mp4"));
  } finally {
    await rm(/*turbopackIgnore: true*/ dir, { recursive: true, force: true });
  }
}

type Caption = { text: string; start: number; end: number };

// A word that ends a phrase, in Latin or CJK punctuation.
const PAUSE = /[,.!?;:、。，！？；：]$/;

// Attaches punctuation segments to the word before them.
function mergePunctuation(segments: string[]) {
  const words: string[] = [];
  for (const s of segments) {
    if (words.length && /^[\p{P}\p{S}]+$/u.test(s))
      words[words.length - 1] += s;
    else words.push(s);
  }
  return words;
}

// Splits the voiceover into short phrases and spreads them over the time it
// is spoken, by length, with a beat for each pause. Close enough to read
// along; no word-level timing needed.
export function timeCaptions(
  text: string,
  start: number,
  seconds: number,
): Caption[] {
  // Japanese and Chinese are written without spaces: split them into words
  // with the runtime's word segmenter, and fit fewer (wider) characters.
  const spaced = !/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text);
  const words = spaced
    ? text.split(/\s+/).filter(Boolean)
    : mergePunctuation(
        [
          ...new Intl.Segmenter(undefined, { granularity: "word" }).segment(
            text,
          ),
        ]
          .map((s) => s.segment.trim())
          .filter(Boolean),
      );
  const join = (w: string[]) => w.join(spaced ? " " : "");
  const maxChars = spaced ? 20 : 10;
  const phrases: string[] = [];
  let current: string[] = [];
  for (const word of words) {
    current.push(word);
    const pause = PAUSE.test(word);
    if (
      (spaced && current.length >= 4) ||
      join(current).length >= maxChars ||
      (pause && current.length >= 2)
    ) {
      phrases.push(join(current));
      current = [];
    }
  }
  if (current.length) phrases.push(join(current));

  const weight = (p: string) => p.length + (PAUSE.test(p) ? 4 : 0);
  const totalWeight = phrases.reduce((a, p) => a + weight(p), 0);
  let t = start;
  return phrases.map((p) => {
    const end = t + (weight(p) / totalWeight) * seconds;
    const caption = { text: p.replace(/[,;:、，；：]$/, ""), start: t, end };
    t = end;
    return caption;
  });
}

type Fonts = NonNullable<
  ConstructorParameters<typeof ImageResponse>[1]
>["fonts"];

async function renderLayer(layer: ReactElement, fonts: Fonts) {
  const image = new ImageResponse(layer, { ...AD_SIZES["9:16"], fonts });
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
