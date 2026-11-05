// Local decode and technical checks. This module makes no network requests.
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {QualityError,QualityReviewUnavailableError,sampleTimes} from "./media-quality-policy";
const exec=promisify(execFile);
// Width over height per ad size. A 4:5 ad may come back 3:4 (FLUX Kontext has
// no 4:5); the renderer crops it.
const RATIOS={"1:1":[1],"2:3":[2/3],"4:5":[4/5,3/4],"9:16":[9/16]} as const;
export async function inspectAdImage(bytes:Buffer,aspect:keyof typeof RATIOS){
 try{
  const source=sharp(bytes,{limitInputPixels:24000000,failOn:"error"}),meta=await source.metadata();
  const width=meta.width??0,height=meta.height??0,ratios:readonly number[]=RATIOS[aspect]??RATIOS["1:1"];
  const minWidth=aspect==="1:1"?960:720;
  if(width<minWidth||height<Math.round(minWidth/ratios[ratios.length-1]*.98))throw new QualityError("The image resolution is too low for the requested ad format.");
  if(!ratios.some(ratio=>Math.abs(width/height/ratio-1)<=.04))throw new QualityError("The image has the wrong proportions for the ad.");
  const stats=await source.resize({width:96,height:96,fit:"inside"}).removeAlpha().stats();
  if(stats.channels.slice(0,3).every(c=>c.stdev<1))throw new QualityError("The image is blank or almost uniform.");
  return {width,height};
 }catch(error){if(error instanceof QualityError)throw error;throw new QualityError("The generated image could not be decoded correctly.");}
}
export type VideoQualityFrame={shot:number;time:number;jpeg:Buffer};
export function videoProbe(stderr:string){
 const dimension=stderr.match(/Video:[^\r\n]*?\b(\d{2,5})x(\d{2,5})\b/);
 const duration=stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
 const times=[...stderr.matchAll(/time=(\d+):(\d+):(\d+\.\d+)/g)];
 const toSeconds=(m:RegExpMatchArray|undefined|null)=>m?+m[1]*3600+ +m[2]*60+ +m[3]:NaN;
 return {width:dimension?+dimension[1]:0,height:dimension?+dimension[2]:0,seconds:Math.min(toSeconds(duration),toSeconds(times.at(-1)))};
}
export async function sampleVideoShots(clips:Buffer[],seconds:readonly number[]):Promise<VideoQualityFrame[]>{
 if(!ffmpegPath)throw new QualityReviewUnavailableError("Video inspection is unavailable.");
 if(clips.length!==seconds.length||!clips.length||clips.length>7)throw new QualityError("The video has an unexpected number of shots.");
 const dir=await mkdtemp(join(/*turbopackIgnore: true*/tmpdir(),"gooidy-quality-"));
 const deadline=performance.now()+60000;
 const timeout=()=>{const remaining=Math.floor(deadline-performance.now());if(remaining<=0)throw new QualityReviewUnavailableError("Video inspection took too long.");return Math.min(15000,remaining);};
 const frames:VideoQualityFrame[]=[];
 try{
  for(let shot=0;shot<clips.length;shot++){
   const path=join(/*turbopackIgnore: true*/dir,"shot-"+shot+".mp4");await writeFile(/*turbopackIgnore: true*/path,clips[shot]);
   let report:string;
   try{const result=await exec(ffmpegPath,["-hide_banner","-i",path,"-map","0:v:0","-an","-f","null","-"],{timeout:timeout(),maxBuffer:2e6});report=result.stderr;}
   catch(error){if(error instanceof QualityReviewUnavailableError)throw error;throw new QualityError("A generated video shot could not be decoded.");}
   const probe=videoProbe(report);
   if(probe.width<720||probe.height<1280||Math.abs(probe.width/probe.height/(9/16)-1)>.04)throw new QualityError("A generated video shot has insufficient resolution or incorrect framing.");
   if(!Number.isFinite(probe.seconds)||probe.seconds<seconds[shot]-.2)throw new QualityError("A generated video shot ends before its planned cut.");
   for(const time of sampleTimes(seconds[shot])){
    const result=await exec(ffmpegPath,["-v","error","-ss",String(time),"-i",path,"-frames:v","1","-vf","scale=640:1138:force_original_aspect_ratio=decrease","-q:v","3","-f","image2pipe","-vcodec","mjpeg","pipe:1"],{encoding:"buffer",timeout:timeout(),maxBuffer:1500000});
    if(!result.stdout.length)throw new QualityError("A generated video shot is missing a required frame.");
    const stats=await sharp(result.stdout).resize(96).stats();
    if(stats.channels.slice(0,3).every(c=>c.stdev<1))throw new QualityError("A generated video shot contains a blank sampled frame.");
    let jpeg=await sharp(result.stdout).jpeg({quality:78}).toBuffer();
    if(jpeg.length>350000)jpeg=await sharp(jpeg).resize({width:512}).jpeg({quality:65}).toBuffer();
    if(jpeg.length>350000)throw new QualityReviewUnavailableError("A video review sample exceeds the inspection budget.");
    frames.push({shot,time,jpeg});
   }
  }
  return frames;
 }finally{await rm(/*turbopackIgnore: true*/dir,{recursive:true,force:true});}
}
