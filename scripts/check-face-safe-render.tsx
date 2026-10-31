import assert from "node:assert/strict";
import {readFile,writeFile,mkdtemp,rm,readdir,stat} from "node:fs/promises";
import {createRequire} from "node:module";
import {dirname,join} from "node:path";
import {tmpdir} from "node:os";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import {ImageResponse} from "next/og";
import {AdLayout,AD_SIZES,adTextStyles} from "../src/lib/ad-layout";
import {HookLayer,CaptionLayer,EndCardLayer,VIDEO_TEXT_STYLES} from "../src/lib/video-layout";
import {chooseOverlays,chooseCaption,protectFaces,type Rect} from "../src/lib/face-safe-layout";
import {detectFaces} from "../src/lib/face-detection";
import {prepareText} from "../src/lib/ad-text";
import {editVideoAd} from "../src/lib/video-edit";
async function main(){
 const exec=promisify(execFile),font=await readFile("src/fonts/Inter-Bold.ttf"),source=await readFile("public/reels/softmila-still.jpg");
 const fonts=[{name:"Inter",data:font,weight:700 as const,style:"normal" as const}],brand={name:"Inter",data:font};
 const base={fontFamily:"Inter",accentColor:"#7364ff",accentTextColor:"white",logoUrl:null};
 const dir=await mkdtemp(join(tmpdir(),"adaptive-face-test-"));
 async function png(tree:React.ReactElement,aspect:"1:1"|"9:16"="9:16"){return Buffer.from(await new ImageResponse(tree,{...AD_SIZES[aspect],fonts}).arrayBuffer());}
 async function transparentAtFaces(bytes:Buffer,faces:Rect[],width=1080,height=1920){
  const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(const r of protectFaces(faces,width,height))for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++)assert.equal(data[(y*info.width+x)*4+3],0,"Overlay paints into protected face");
 }
 try{
  const require=createRequire(import.meta.url),dist=dirname(require.resolve("onnxruntime-web"));
  console.log("ORT_FILES",dist,(await Promise.all((await readdir(dist)).filter(n=>n.endsWith(".wasm")).map(async n=>({name:n,bytes:(await stat(join(dist,n))).size})))));
  const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{throw new Error("Face analysis must not make network calls");};
  let originalFaces:Rect[]|null=null;try{originalFaces=await detectFaces(source);}finally{globalThis.fetch=originalFetch;}
  assert.ok(originalFaces&&originalFaces.length>=1,"Real portrait face must be detected locally");
  console.log("PASS actual local model detects real portrait without network",originalFaces.length);
  for(const aspect of ["1:1","9:16"] as const){
   const size=AD_SIZES[aspect],photo=await sharp(source).resize(size.width,size.height,{fit:"cover"}).png().toBuffer(),faces=await detectFaces(photo);
   assert.ok(faces&&faces.length>0);
   for(const [title,button] of [["Your Shoes Shouldn’t Slow You Down","Shop now"],["راحة تدوم طوال اليوم","تسوق الآن"],["हर कदम पर आराम","अभी खरीदें"]]){
    const placement=chooseOverlays(aspect,faces,{headline:true,cta:button,logo:false}),style=adTextStyles(aspect,"white",placement);
    console.log("PORTRAIT_PLAN",JSON.stringify({aspect,faces,placement}));
    assert.ok(placement.headline&&placement.cta,"Normal portrait keeps a headline and button");
    const headline=await prepareText(title,style.headline,brand),cta=await prepareText(button,style.cta,brand);
    const props={...base,aspect,headline,cta,placement,rtl:title.includes("راحة")};
    const overlays=await png(<AdLayout {...props} photoUrl={null}/>,aspect);await transparentAtFaces(overlays,faces,size.width,size.height);
    const full=await png(<AdLayout {...props} photoUrl={"data:image/png;base64,"+photo.toString("base64")}/>,aspect);
    const pixels=await sharp(full).ensureAlpha().raw().toBuffer(),original=await sharp(photo).ensureAlpha().raw().toBuffer();
    // Full image reaches all four corners; no framed or letterboxed fallback.
    for(const [x,y] of [[1,1],[1078,1],[1,size.height-2],[1078,size.height-2]]){const i=(y*size.width+x)*4;for(let c=0;c<3;c++)assert.ok(Math.abs(pixels[i+c]-original[i+c])<=2);}
    if(aspect==="9:16"&&title.startsWith("Your")){
     const b=(await sharp(full).resize({width:390}).jpeg({quality:80}).toBuffer()).toString("base64");for(let i=0;i<b.length;i+=4000)console.log("ADAPTIVE_IMAGE",i/4000,b.slice(i,i+4000));
    }
   }
   console.log("PASS full-frame render and zero face-overlay pixels in Latin, Arabic and Hindi",aspect);
  }
  const f=protectFaces(originalFaces,800,800)[0];
  const crop=await sharp(source).extract({left:f.x,top:f.y,width:f.width,height:f.height}).resize({width:260,height:320,fit:"cover"}).png().toBuffer();
  const group=await sharp({create:{width:1080,height:1920,channels:3,background:"#b9b0a0"}}).composite([{input:crop,left:30,top:200},{input:crop,left:770,top:1320}]).png().toBuffer();
  const groups=await detectFaces(group);assert.ok(groups&&groups.length>=2,"Group faces must both be protected");
  const plan=chooseOverlays("9:16",groups,{headline:true,cta:"Shop now",logo:false});
  await transparentAtFaces(await png(<AdLayout {...base} photoUrl={null} aspect="9:16" headline="Made for your everyday" cta="Shop now" placement={plan}/>),groups);
  const captionRegion=chooseCaption("9:16",groups),hook=chooseOverlays("9:16",groups,{headline:true},captionRegion?[captionRegion]:[]);
  await transparentAtFaces(await png(<HookLayer headline="Made for your everyday" fontFamily="Inter" region={hook.headline}/>),groups);
  const caption=await prepareText("Move at your own pace",VIDEO_TEXT_STYLES.caption,brand);
  await transparentAtFaces(await png(<CaptionLayer text={caption} fontFamily="Inter" region={captionRegion}/>),groups);
  await transparentAtFaces(await png(<EndCardLayer {...base} headline="Made for your everyday" cta="Shop now" placement={chooseOverlays("9:16",groups,{headline:true,cta:"Shop now"},captionRegion?[captionRegion]:[])}/>),groups);
  console.log("PASS group and edge-face protection for image, hook, subtitles and closing overlays");
  assert.ok(ffmpegPath);await writeFile(join(dir,"face.png"),crop);
  await exec(ffmpegPath,["-y","-f","lavfi","-i","color=c=0xb9b0a0:s=1080x1920:r=30:d=2","-loop","1","-i",join(dir,"face.png"),"-filter_complex","[0:v][1:v]overlay=x=350+300*sin(t*3):y=150+200*sin(t*2):shortest=1","-t","2","-c:v","libx264","-preset","ultrafast","-pix_fmt","yuv420p",join(dir,"clip.mp4")],{timeout:60000,maxBuffer:3e6});
  await exec(ffmpegPath,["-y","-f","lavfi","-i","sine=frequency=440:duration=2.8",join(dir,"voice.mp3")],{timeout:30000,maxBuffer:3e6});
  await exec(ffmpegPath,["-y","-f","lavfi","-i","sine=frequency=220:duration=4",join(dir,"music.wav")],{timeout:30000,maxBuffer:3e6});
  const clip=await readFile(join(dir,"clip.mp4")),start=performance.now();
  const edited=await editVideoAd({...base,fontName:"Inter",font,clips:[clip,clip],shotSeconds:[2,2],voice:await readFile(join(dir,"voice.mp3")),music:await readFile(join(dir,"music.wav")),voiceover:"Comfort for every step. Find your next favorite.",headline:"Made for your everyday",cta:"Shop now"});
  await writeFile(join(dir,"edited.mp4"),edited);
  for(const time of [.6,1.5,2.2,3.4]){
   const frame:{stdout:Buffer;stderr:Buffer}=await exec(ffmpegPath,["-v","error","-ss",String(time),"-i",join(dir,"edited.mp4"),"-frames:v","1","-f","image2pipe","-vcodec","png","pipe:1"],{encoding:"buffer",maxBuffer:10e6,timeout:30000});
   const info=await sharp(frame.stdout).metadata();assert.equal(info.width,1080);assert.equal(info.height,1920);
   const visible=await detectFaces(frame.stdout);assert.ok(visible&&visible.length>0,"Moving face remains visible through hook, captions and closing copy");
  }
  console.log("PASS real all-frame video analysis and full-frame FFmpeg edit",Math.round(performance.now()-start),"ms");
 }finally{await rm(dir,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
