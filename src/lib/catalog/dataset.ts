import "server-only";
import {createHash} from "node:crypto";
import sharp from "sharp";
import {zipSync} from "fflate";
import {fetchPublicUrl} from "@/lib/public-fetch";
import {createAdminClient} from "@/lib/supabase/admin";
import {jobStatus} from "./store";
import {trainingAllowed} from "./security";
import {trainingTrigger} from "./replicate";
export const MIN_TRAINING_IMAGES=10;
const hash=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
function difference(a:Uint8Array,b:Uint8Array){let count=0;for(let i=0;i<a.length;i++)if(Math.abs(a[i]-b[i])>12)count++;return count;}
export async function prepareTrainingDataset(id:string){
 const db=createAdminClient();const {data:job,error}=await db.from("catalog_training_jobs").select("*,catalog_items(*)").eq("id",id).single();if(error||!job)throw new Error("CATALOG_JOB_NOT_FOUND");
 if(job.status!=="queued")return ["dataset_ready","submitting","submission_unknown","running","succeeded"].includes(job.status);
 const item=job.catalog_items;if(!item||!trainingAllowed(job.workspace_id,item.product_url))return false;
 if(item.image_revision!==job.image_revision){await jobStatus(id,{status:"blocked",error_code:"STALE_SOURCE_REVISION"});return false;}
 const {data:connection}=await db.from("catalog_connections").select("enabled").eq("id",item.connection_id).single();if(!connection?.enabled)return false;
 const images=Array.isArray(item.images)?item.images.slice(0,30):[];if(images.length<MIN_TRAINING_IMAGES){await jobStatus(id,{status:"blocked",error_code:"INSUFFICIENT_SOURCE_IMAGES"});return false;}
 const files:Record<string,Uint8Array>={},digests:string[]=[],thumbs:Uint8Array[]=[];const started=Date.now();let total=0;
 for(const url of images){
  if(digests.length===20||Date.now()-started>55000)break;
  try{
   const result=await fetchPublicUrl(url,{maxBytes:6*1024*1024,timeoutMs:Math.min(8000,60000-(Date.now()-started)),accept:"image/*"});
   if(result.status!==200||!["image/jpeg","image/png","image/webp","image/avif"].includes(result.contentType))continue;
   const image=sharp(result.body,{limitInputPixels:32000000,animated:false});const meta=await image.metadata();if(!meta.width||!meta.height||Math.min(meta.width,meta.height)<768||(meta.pages??1)>1)continue;
   const normalized=await image.rotate().resize(1024,1024,{fit:"inside",withoutEnlargement:true}).jpeg({quality:95}).toBuffer();const digest=hash(normalized);if(digests.includes(digest))continue;
   const thumb=new Uint8Array(await sharp(normalized).resize(8,8,{fit:"fill"}).greyscale().raw().toBuffer());if(thumbs.some(old=>difference(old,thumb)<8))continue;
   total+=normalized.length;if(total>32*1024*1024)break;thumbs.push(thumb);digests.push(digest);const name="image_"+String(digests.length).padStart(3,"0");files[name+".jpg"]=new Uint8Array(normalized);files[name+".txt"]=new TextEncoder().encode("a product photograph of "+trainingTrigger(id));
  }catch{continue;}
 }
 if(digests.length<MIN_TRAINING_IMAGES){await jobStatus(id,{status:"blocked",image_count:digests.length,error_code:"INSUFFICIENT_DISTINCT_HIGH_RES_IMAGES"});return false;}
 const datasetHash=hash(new TextEncoder().encode([...digests].sort().join("\n")));const archive=zipSync(files,{level:0,mtime:new Date("1980-01-01T00:00:00Z")});const path=job.workspace_id+"/"+id+"/dataset.zip";
 const {error:upload}=await db.storage.from("catalog-training").upload(path,archive,{contentType:"application/zip",upsert:false});
 if(upload){const {data:existing,error:readError}=await db.storage.from("catalog-training").download(path);if(readError||!existing||hash(new Uint8Array(await existing.arrayBuffer()))!==hash(archive))throw new Error("CATALOG_DATASET_STORAGE_CONFLICT");}
 const {data:updated,error:save}=await db.from("catalog_training_jobs").update({status:"dataset_ready",dataset_path:path,dataset_hash:datasetHash,image_count:digests.length,error_code:null}).eq("id",id).eq("status","queued").select("id").maybeSingle();
 if(save?.code==="23505"){await jobStatus(id,{status:"blocked",error_code:"DUPLICATE_TRAINING_DATASET"});return false;}if(save)throw new Error("CATALOG_DATASET_WRITE_FAILED");return !!updated;
}
