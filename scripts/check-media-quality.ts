import assert from "node:assert/strict";
import {mkdtemp,readFile,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import {inspectAdImage,sampleVideoShots,videoProbe} from "../src/lib/media-quality";
import {editVideoAd} from "../src/lib/video-edit";
import {QualityError,requireReview,voiceTempo} from "../src/lib/media-quality-policy";
async function main(){
 assert.ok(ffmpegPath);
 const exec=promisify(execFile),dir=await mkdtemp(join(tmpdir(),"quality-fixture-"));
 // Any accidental provider request fails. Fixtures use no credentials or customer rows.
 const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{throw Error("Network forbidden in offline quality tests");};
 try{
  const photo=await readFile("public/reels/softmila-still.jpg");
  const square=await sharp(photo).resize(1024,1024,{fit:"cover"}).jpeg().toBuffer();
  const portrait=await sharp(photo).resize(768,1344,{fit:"cover"}).jpeg().toBuffer();
  assert.deepEqual(await inspectAdImage(square,"1:1"),{width:1024,height:1024});
  await inspectAdImage(portrait,"9:16");
  await assert.rejects(inspectAdImage(await sharp(photo).resize(300,300).jpeg().toBuffer(),"1:1"),QualityError);
  await assert.rejects(inspectAdImage(square,"9:16"),QualityError);
  await assert.rejects(inspectAdImage(await sharp({create:{width:1024,height:1024,channels:3,background:"#000"}}).jpeg().toBuffer(),"1:1"),QualityError);
  await assert.rejects(inspectAdImage(Buffer.from("broken"),"1:1"),QualityError);
  console.log("PASS image decode, resolution, proportions and blank-output checks");
  const parsed=videoProbe("Video: h264, yuv420p, 720x1280, 30 fps\nDuration: 00:00:04.00\ntime=00:00:03.97");
  assert.equal(parsed.width,720);assert.equal(parsed.height,1280);assert.equal(parsed.seconds,3.97);
  await exec(ffmpegPath,["-y","-f","lavfi","-i","testsrc2=size=720x1280:rate=24:duration=3","-c:v","libx264","-preset","ultrafast","-pix_fmt","yuv420p","-threads","2",join(dir,"valid.mp4")],{timeout:30000,maxBuffer:2e6});
  const clip=await readFile(join(dir,"valid.mp4"));
  const frames=await sampleVideoShots([clip,clip],[3,3]);
  assert.equal(frames.length,6);assert.deepEqual(frames.map(f=>f.shot),[0,0,0,1,1,1]);
  for(const frame of frames){const meta=await sharp(frame.jpeg).metadata();assert.ok(meta.width&&meta.width<=640);assert.ok(meta.height&&meta.height<=1138);}
  await assert.rejects(sampleVideoShots([clip],[4]),QualityError);
  await assert.rejects(sampleVideoShots([Buffer.from("broken")],[3]),QualityError);
  await exec(ffmpegPath,["-y","-f","lavfi","-i","color=c=black:s=720x1280:r=24:d=3","-c:v","libx264","-preset","ultrafast",join(dir,"blank.mp4")],{timeout:30000,maxBuffer:2e6});
  await assert.rejects(sampleVideoShots([await readFile(join(dir,"blank.mp4"))],[3]),QualityError);
  const rejected=await requireReview(async()=>({ok:false,issues:"Product morphs in the last sample"}));assert.equal(rejected.ok,false);
  console.log("PASS every-shot video samples, short/corrupt/blank clip rejection and visual verdict handling");
  await exec(ffmpegPath,["-y","-f","lavfi","-i","sine=frequency=440:duration=4",join(dir,"voice.mp3")],{timeout:30000,maxBuffer:2e6});
  await exec(ffmpegPath,["-y","-f","lavfi","-i","sine=frequency=220:duration=7",join(dir,"music.wav")],{timeout:30000,maxBuffer:2e6});
  const font=await readFile("src/fonts/Inter-Bold.ttf"),voice=await readFile(join(dir,"voice.mp3"));
  const edit={clips:[clip,clip],shotSeconds:[3,3],voice,music:await readFile(join(dir,"music.wav")),voiceover:"Your next favorite. Shop now.",headline:"Made for your day",cta:"Shop now",fontName:"Inter",font,accentColor:"#7364ff",accentTextColor:"white",logoUrl:null};
  const output=await editVideoAd(edit);await writeFile(join(dir,"out.mp4"),output);
  const probe=await exec(ffmpegPath,["-hide_banner","-i",join(dir,"out.mp4"),"-f","null","-"],{timeout:30000,maxBuffer:2e6});
  assert.ok(probe.stderr.includes("1080x1920"));assert.ok(probe.stderr.includes("Audio: aac"));assert.ok(output.indexOf("moov")<output.indexOf("mdat"));
  const tail=await exec(ffmpegPath,["-v","error","-ss","5","-i",join(dir,"out.mp4"),"-t","0.4","-map","0:a:0","-ac","1","-ar","16000","-f","s16le","pipe:1"],{encoding:"buffer",timeout:30000,maxBuffer:2e6});
  assert.ok(tail.stdout.length>1000,"Music bed continues after narration ends");
  let energy=0;for(let i=0;i<tail.stdout.length;i+=2)energy+=tail.stdout.readInt16LE(i)**2;
  assert.ok(energy>100000,"Closing audio is not truncated or silent");
  assert.ok(voiceTempo(4,6)<=1.2);
  await assert.rejects(editVideoAd({...edit,shotSeconds:[1,1]}),QualityError);
  console.log("PASS real full-frame MP4 edit, voice/music ducking, export codecs and uncut-voice guard");
 }finally{globalThis.fetch=originalFetch;await rm(dir,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
