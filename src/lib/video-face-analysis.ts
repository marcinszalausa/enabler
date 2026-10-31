// Inspect every frame of the exact full-frame crop used by the compositor.
// Keep a stable set of protected face boxes for each shot, so text does not
// jitter frame-by-frame. Incomplete analysis yields no overlays for that shot.
import {spawn} from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import {detectFaces} from "@/lib/face-detection";
import type {Rect} from "@/lib/face-safe-layout";
export const VIDEO_CROP="scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30";
export async function analyzeShotFaces(path:string,seconds:number,deadline:number):Promise<Rect[]|null>{
 if(!ffmpegPath||performance.now()>=deadline)return null;
 const frameBytes=360*640*3,all:Rect[]=[];let pending=Buffer.alloc(0),frames=0,stderr="";
 const child=spawn(ffmpegPath,["-v","error","-i",path,"-vf",VIDEO_CROP+",scale=360:640","-t",String(seconds),"-an","-f","rawvideo","-pix_fmt","rgb24","pipe:1"],{stdio:["ignore","pipe","pipe"]});
 child.stderr.on("data",b=>{stderr=(stderr+b).slice(-2000);});
 const ended=new Promise<void>((resolve,reject)=>{child.once("error",reject);child.once("close",code=>code===0?resolve():reject(new Error("Frame analysis interrupted")));});
 // Attach the handler immediately; a killed child may finish while inference
 // is still running. No rejected child promise is left unobserved.
 ended.catch(()=>undefined);
 const timer=setTimeout(()=>child.kill("SIGKILL"),Math.max(1,deadline-performance.now()));
 try{
  for await(const chunk of child.stdout){
   pending=Buffer.concat([pending,chunk]);
   while(pending.length>=frameBytes){
    if(performance.now()>=deadline)throw new Error("Frame analysis deadline");
    const frame=pending.subarray(0,frameBytes);pending=pending.subarray(frameBytes);
    const faces=await detectFaces(frame,{width:360,height:640});if(faces===null)throw new Error("Face analysis unavailable");
    all.push(...faces.map(f=>({x:f.x*3,y:f.y*3,width:f.width*3,height:f.height*3})));frames++;
   }
  }
  await ended;
  if(pending.length||frames!==Math.round(seconds*30))throw new Error("Incomplete frame analysis");
  return all;
 }catch(error){child.kill("SIGKILL");await ended.catch(()=>undefined);console.error("Video overlay analysis unavailable",error instanceof Error?error.message:stderr);return null;}
 finally{clearTimeout(timer);}
}
