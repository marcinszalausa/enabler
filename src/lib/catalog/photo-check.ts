import {createHash} from "node:crypto";
import sharp from "sharp";
import {fetchPublicUrl} from "../public-fetch";

export const MIN_TRAINING_IMAGES=10;
export type PhotoVerdict="usable"|"small"|"duplicate"|"unreadable"|"not_checked";
export type PhotoCheck={index:number;status:PhotoVerdict;width?:number;height?:number};
export type PhotoReport={photos:PhotoCheck[];usable:number;minimum:number;ready:boolean;complete:boolean};
const digest=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
function differentPixels(a:Uint8Array,b:Uint8Array){let count=0;for(let i=0;i<a.length;i++)if(Math.abs(a[i]-b[i])>12)count++;return count;}

// Shared by the dashboard check and private training preparation. Never calls a
// paid provider. Only the caller that prepares training keeps the image bytes.
export async function scanCatalogPhotos(input:unknown,download=fetchPublicUrl){
 const images=Array.isArray(input)?input.slice(0,30):[];
 const photos:PhotoCheck[]=[],accepted:{bytes:Buffer;hash:string}[]=[],thumbs:Uint8Array[]=[],urls=new Set<string>();
 const started=Date.now();let downloaded=0,normalizedBytes=0;
 for(const [index,url] of images.entries()){
  if(accepted.length>=20||Date.now()-started>45000||downloaded>=36*1024*1024){photos.push({index,status:"not_checked"});continue;}
  if(typeof url!=="string"){photos.push({index,status:"unreadable"});continue;}
  if(urls.has(url)){photos.push({index,status:"duplicate"});continue;}urls.add(url);
  try{
   const response=await download(url,{maxBytes:Math.min(6*1024*1024,36*1024*1024-downloaded),timeoutMs:Math.max(1,Math.min(8000,45000-(Date.now()-started))),accept:"image/*"});
   downloaded+=response.body.length;
   if(response.status!==200||!["image/jpeg","image/png","image/webp","image/avif"].includes(response.contentType)){photos.push({index,status:"unreadable"});continue;}
   const image=sharp(response.body,{limitInputPixels:32000000,animated:false}),meta=await image.metadata();
   const dimensions={width:meta.width,height:meta.height};
   if(!meta.width||!meta.height||(meta.pages??1)>1||!["jpeg","png","webp","heif","avif"].includes(meta.format??"")){photos.push({index,status:"unreadable"});continue;}
   if(Math.min(meta.width,meta.height)<768){photos.push({index,status:"small",...dimensions});continue;}
   const bytes=await image.rotate().resize(1024,1024,{fit:"inside",withoutEnlargement:true}).jpeg({quality:95}).toBuffer(),hash=digest(bytes);
   const thumb=new Uint8Array(await sharp(bytes).resize(8,8,{fit:"fill"}).greyscale().raw().toBuffer());
   if(accepted.some(old=>old.hash===hash)||thumbs.some(old=>differentPixels(old,thumb)<8)){photos.push({index,status:"duplicate",...dimensions});continue;}
   normalizedBytes+=bytes.length;if(normalizedBytes>32*1024*1024){photos.push({index,status:"not_checked"});continue;}
   accepted.push({bytes,hash});thumbs.push(thumb);photos.push({index,status:"usable",...dimensions});
  }catch{photos.push({index,status:"unreadable"});}
 }
 const report:PhotoReport={photos,usable:accepted.length,minimum:MIN_TRAINING_IMAGES,ready:accepted.length>=MIN_TRAINING_IMAGES,complete:!photos.some(p=>p.status==="not_checked")};
 return {report,accepted};
}
