// Server-side YuNet detection. Local model/WASM only; no identity inference,
// embeddings, provider calls, or remote photo uploads.
import sharp from "sharp";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {createHash} from "node:crypto";
import * as ort from "onnxruntime-web";
import type {Rect} from "@/lib/face-safe-layout";
const MODEL_SHA="ebafce4e3c118d6554634be5c27ab333b4c047a9a8c3faf1d7cf93101c22f0f0";
let sessionPromise:Promise<ort.InferenceSession>|null=null;
let tail:Promise<unknown>=Promise.resolve();
function session(){
 sessionPromise??=(async()=>{
  ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;
  const bytes=await readFile(join(process.cwd(),"src/models/yunet.onnx"));
  if(createHash("sha256").update(bytes).digest("hex")!==MODEL_SHA)throw new Error("Face model integrity check failed");
  return ort.InferenceSession.create(new Uint8Array(bytes),{executionProviders:["wasm"],graphOptimizationLevel:"all"});
 })().catch(error=>{sessionPromise=null;throw error;});
 return sessionPromise;
}
type Detection={box:Rect;score:number};
function iou(a:Rect,b:Rect){const w=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)),h=Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));const n=w*h;return n/(a.width*a.height+b.width*b.height-n);}
async function scan(image:Buffer,inputSize:number,raw?:{width:number;height:number}):Promise<Detection[]>{
 const source=raw?sharp(image,{raw:{...raw,channels:3}}):sharp(image,{limitInputPixels:24e6});
 const metadata=raw??await source.metadata();if(!metadata.width||!metadata.height)throw new Error("Missing source dimensions");
 const scale=inputSize/Math.max(metadata.width,metadata.height),w=Math.max(1,Math.round(metadata.width*scale)),h=Math.max(1,Math.round(metadata.height*scale));
 const rgb=await source.removeAlpha().toColourspace("srgb").resize(w,h,{fit:"fill"}).extend({left:0,top:0,right:inputSize-w,bottom:inputSize-h,background:"#000000"}).raw().toBuffer();
 const plane=inputSize*inputSize,data=new Float32Array(3*plane);
 for(let i=0;i<plane;i++){data[i]=rgb[i*3+2];data[plane+i]=rgb[i*3+1];data[2*plane+i]=rgb[i*3];}
 const model=await session(),result=await model.run({[model.inputNames[0]]:new ort.Tensor("float32",data,[1,3,inputSize,inputSize])});
 const detections:Detection[]=[];
 for(const stride of [8,16,32]){
  const cls=result["cls_"+stride]?.data as Float32Array,obj=result["obj_"+stride]?.data as Float32Array,bbox=result["bbox_"+stride]?.data as Float32Array;
  if(!cls||!obj||!bbox)throw new Error("Unexpected face model outputs");
  const cols=inputSize/stride;
  for(let i=0;i<cls.length;i++){
   const score=Math.sqrt(Math.max(0,Math.min(1,cls[i]))*Math.max(0,Math.min(1,obj[i])));if(score<.2)continue;
   const cx=((i%cols)+bbox[i*4])*stride,cy=(Math.floor(i/cols)+bbox[i*4+1])*stride,bw=Math.exp(bbox[i*4+2])*stride,bh=Math.exp(bbox[i*4+3])*stride;
   const left=Math.max(0,(cx-bw/2)/scale),top=Math.max(0,(cy-bh/2)/scale),right=Math.min(metadata.width,(cx+bw/2)/scale),bottom=Math.min(metadata.height,(cy+bh/2)/scale);
   if([left,top,right,bottom,score].every(Number.isFinite)&&right>left&&bottom>top)detections.push({box:{x:left,y:top,width:right-left,height:bottom-top},score});
  }
 }
 return detections;
}
const cache=new Map<string,Promise<Rect[]|null>>();
export function detectFaces(image:Buffer,raw?:{width:number;height:number}):Promise<Rect[]|null>{
 const key=createHash("sha256").update(image).update(JSON.stringify(raw??null)).digest("hex");
 const cached=cache.get(key);if(cached)return cached;
 const work=tail.then(async()=>{
  try{
   const all=[...await scan(image,640,raw),...await scan(image,320,raw)].sort((a,b)=>b.score-a.score);
   const keep:Detection[]=[];for(const item of all){if(!keep.some(other=>iou(item.box,other.box)>.3))keep.push(item);if(keep.length>=100)return null;}
   return keep.map(item=>item.box);
  }catch(error){console.error("Face placement analysis unavailable",error instanceof Error?error.message:"unknown");return null;}
 });
 tail=work.then(()=>undefined,()=>undefined);
 if(cache.size>=64)cache.delete(cache.keys().next().value!);cache.set(key,work);
 work.then(result=>{if(result===null)cache.delete(key);});
 return work;
}
