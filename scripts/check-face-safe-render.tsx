import assert from "node:assert/strict";
import {readFile,writeFile,mkdtemp,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import {ImageResponse} from "next/og";
import {AdLayout,AD_SIZES,adTextStyles} from "../src/lib/ad-layout";
import {HookLayer,CaptionLayer,EndCardLayer,VIDEO_TEXT_STYLES} from "../src/lib/video-layout";
import {IMAGE_REGIONS,VIDEO_REGIONS,type Rect} from "../src/lib/face-safe-layout";
import {prepareText} from "../src/lib/ad-text";
import {editVideoAd} from "../src/lib/video-edit";
async function main(){
const exec=promisify(execFile),font=await readFile("src/fonts/Inter-Bold.ttf");
const fonts=[{name:"Inter",data:font,weight:700 as const,style:"normal" as const}];
const brand={name:"Inter",data:font};
const base={fontFamily:"Inter",accentColor:"#7364ff",accentTextColor:"white",logoUrl:null};
const dir=await mkdtemp(join(tmpdir(),"face-safe-test-"));
async function png(tree:React.ReactElement,aspect:"1:1"|"9:16"="9:16"){return Buffer.from(await new ImageResponse(tree,{...AD_SIZES[aspect],fonts}).arrayBuffer());}
async function mediaIsTransparent(bytes:Buffer,rect:Rect){
 const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let y=rect.y;y<rect.y+rect.height;y++)for(let x=rect.x;x<rect.x+rect.width;x++)assert.equal(data[(y*info.width+x)*4+3],0,"A text layer painted over footage");
}
try{
 // A saturated test photo makes any overlay of text/brand pixels measurable.
 for(const aspect of ["1:1","9:16"] as const){
  const r=IMAGE_REGIONS[aspect].media;
  const photo=await sharp({create:{width:r.width,height:r.height,channels:3,background:"#00ff00"}}).png().toBuffer();
  for(const [headline,cta] of [["Your Shoes Shouldn’t Slow You Down","Shop now"],["راحة تدوم طوال اليوم","تسوق الآن"],["हर कदम पर आराम","अभी खरीदें"],["Very long copy ".repeat(30),"Long button ".repeat(20)]]){
   const style=adTextStyles(aspect,"white"),h=await prepareText(headline,style.headline,brand),c=await prepareText(cta,style.cta,brand);
   const out=await png(<AdLayout {...base} aspect={aspect} photoUrl={"data:image/png;base64,"+photo.toString("base64")} headline={h} cta={c} rtl={headline.includes("راحة")}/>,aspect);
   const {data,info}=await sharp(out).extract({left:r.x+2,top:r.y+2,width:r.width-4,height:r.height-4}).removeAlpha().raw().toBuffer({resolveWithObject:true});
   for(let i=0;i<data.length;i+=info.channels){assert.ok(data[i]<5&&data[i+1]>250&&data[i+2]<5,"Text or brand control entered the photo");}
  }
  console.log("PASS protected photo pixels with Latin, Arabic, Hindi and oversized copy",aspect);
 }
 const hook=await prepareText("Your Shoes Shouldn’t Slow You Down",VIDEO_TEXT_STYLES.hook,brand);
 const caption=await prepareText("Move at your own pace",VIDEO_TEXT_STYLES.caption,brand);
 const hookPng=await png(<HookLayer headline={hook} fontFamily="Inter"/>),captionPng=await png(<CaptionLayer text={caption} fontFamily="Inter"/>);
 await mediaIsTransparent(hookPng,VIDEO_REGIONS.media);await mediaIsTransparent(captionPng,VIDEO_REGIONS.media);
 const end=await png(<EndCardLayer {...base} headline="Your next great run" cta="Shop now"/>);
 const alpha=await sharp(end).ensureAlpha().extractChannel(3).raw().toBuffer();assert.ok(alpha.every(v=>v===255),"Closing card must completely replace footage");
 console.log("PASS video hooks/subtitles never paint into footage; closing card is fully opaque");
 assert.ok(ffmpegPath);
 const faceSvg='<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg"><circle cx="64" cy="64" r="60" fill="#ff0000"/><circle cx="44" cy="48" r="7" fill="#111"/><circle cx="84" cy="48" r="7" fill="#111"/><path d="M40 82Q64 106 88 82" fill="none" stroke="#111" stroke-width="6"/></svg>';
 await sharp(Buffer.from(faceSvg)).png().toFile(join(dir,"face.png"));
 await exec(ffmpegPath,["-y","-f","lavfi","-i","color=c=0x008000:s=1080x1920:r=30:d=4","-loop","1","-i",join(dir,"face.png"),"-filter_complex","[0:v][1:v]overlay=x=(W-w)/2+300*sin(t*4):y=(H-h)/2+800*sin(t*2):shortest=1","-t","4","-c:v","libx264","-preset","ultrafast","-pix_fmt","yuv420p",join(dir,"clip.mp4")],{timeout:60000,maxBuffer:3e6});
 await exec(ffmpegPath,["-y","-f","lavfi","-i","sine=frequency=440:duration=4.5",join(dir,"voice.mp3")],{timeout:30000,maxBuffer:3e6});
 await exec(ffmpegPath,["-y","-f","lavfi","-i","sine=frequency=220:duration=7",join(dir,"music.wav")],{timeout:30000,maxBuffer:3e6});
 const clip=await readFile(join(dir,"clip.mp4"));
 const edited=await editVideoAd({...base,fontName:"Inter",font,clips:[clip,clip],shotSeconds:[4,3],voice:await readFile(join(dir,"voice.mp3")),music:await readFile(join(dir,"music.wav")),voiceover:"Comfort for every step. Move at your own pace. Find your next favorite.",headline:"Your Shoes Shouldn’t Slow You Down",cta:"Shop now"});
 await writeFile(join(dir,"edited.mp4"),edited);
 for(const time of [0.6,1.6,2.7,4.5,6]){
  const result=await exec(ffmpegPath,["-v","error","-ss",String(time),"-i",join(dir,"edited.mp4"),"-frames:v","1","-f","image2pipe","-vcodec","png","pipe:1"],{encoding:"buffer",maxBuffer:10e6,timeout:30000});
  const {data,info}=await sharp(result.stdout).removeAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.width,1080);assert.equal(info.height,1920);
  let red=0,white=0,green=0;
  for(let y=0;y<VIDEO_REGIONS.media.height;y++)for(let x=0;x<info.width;x++){const i=(y*info.width+x)*info.channels;const [r,g,b]=[data[i],data[i+1],data[i+2]];if(r>170&&g<90&&b<90)red++;if(r>200&&g>200&&b>200)white++;if(r<60&&g>90&&b<60)green++;}
  if(time<5.5){assert.ok(red>1500,"Moving face must remain visible");assert.equal(white,0,"Text pixels overlap moving footage");assert.ok(green>100000);}
  else{assert.equal(red,0);assert.equal(green,0);}
 }
 console.log("PASS real FFmpeg composite: moving face stays visible, all source footage fits, no text overlap, opaque end card");
 // A compact rendered artifact for human inspection, not a provider-generated ad.
 const preview=await png(<AdLayout {...base} aspect="9:16" photoUrl={"data:image/png;base64,"+(await sharp({create:{width:1080,height:1920,channels:3,background:"#e5e0d6"}}).composite([{input:await readFile(join(dir,"face.png")),left:476,top:100}]).png().toBuffer()).toString("base64")} headline="Your Shoes Shouldn’t Slow You Down" cta="Shop now"/>);
 const b=(await sharp(preview).resize({width:390}).jpeg({quality:80}).toBuffer()).toString("base64");for(let i=0;i<b.length;i+=4000)console.log("FACE_SAFE_IMAGE",i/4000,b.slice(i,i+4000));
}finally{await rm(dir,{recursive:true,force:true});}


}
main().catch(error=>{console.error(error);process.exitCode=1;});
