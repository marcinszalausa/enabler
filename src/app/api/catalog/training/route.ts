import {after} from "next/server";
import {createHash} from "node:crypto";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {photoReviewItem,validCatalogId} from "@/lib/catalog/photo-access";
import {trainingPhotos} from "@/lib/catalog/training-photos";
import {trainingSetup,selectedPhotoKeys} from "@/lib/catalog/training-policy";
import {catalogBody,trainingAllowed} from "@/lib/catalog/security";
import {inngest} from "@/inngest/client";
const reply=(code:string,status:number)=>Response.json({code},{status,headers:{"Cache-Control":"private, no-store"}});
export async function POST(request:Request){
 if(request.headers.get("origin")!==new URL(request.url).origin)return reply("ACCESS_DENIED",403);
 try{
  const input=JSON.parse((await catalogBody(request,8192)).toString());if(!validCatalogId(input.itemId))return reply("INVALID_REQUEST",400);
  const client=await createClient(),item=await photoReviewItem(client,input.itemId);if(!item)return reply("ACCESS_DENIED",403);
  const {data:{user}}=await client.auth.getUser();if(!user)return reply("ACCESS_DENIED",403);
  const db=createAdminClient(),setup=trainingSetup();let jobId:string;
  if(input.action==="prepare"){
   if(!setup.configured)return reply("TRAINING_SETUP_REQUIRED",503);
   if(input.rightsConfirmed!==true||input.productConfirmed!==true)return reply("PHOTO_REVIEW_REQUIRED",400);
   if(input.sourceRevision!==item.image_revision)return reply("PHOTOS_CHANGED",409);
   const keys=selectedPhotoKeys(input.photos),available=await trainingPhotos(item);
   const photos=keys.map(key=>{const p=available.find(p=>p.key===key);if(!p)throw new Error("PHOTO_SELECTION_INVALID");return p.path?{key,path:p.path}:{key,url:p.url};});
   const revision=createHash("sha256").update(JSON.stringify({source:item.image_revision,photos})).digest("hex");
   const {data,error}=await db.rpc("queue_catalog_training",{ws:item.workspace_id,item:item.id,revision,source:item.image_revision,photos,trainer:process.env.REPLICATE_TRAINER_VERSION,destination:process.env.REPLICATE_TRAINING_DESTINATION,actor:user.id});if(error||!data)return reply("PREPARATION_UNAVAILABLE",503);jobId=data;
  }else if(input.action==="start"){
   if(!setup.spendingEnabled||!trainingAllowed(item.workspace_id,item.product_url))return reply("TRAINING_SETUP_REQUIRED",503);
   if(!validCatalogId(input.jobId)||input.budgetConfirmed!==true)return reply("BUDGET_CONFIRMATION_REQUIRED",400);
   const {data,error}=await db.rpc("request_catalog_training",{job:input.jobId,item:item.id,actor:user.id});if(error||!data)return reply("TRAINING_NOT_READY_OR_FUNDED",409);jobId=input.jobId;
  }else if(input.action==="review"){
   if(!validCatalogId(input.jobId)||!["approved","rejected"].includes(input.verdict))return reply("INVALID_REQUEST",400);
   if(input.verdict==="approved"&&input.fidelityConfirmed!==true)return reply("MODEL_REVIEW_REQUIRED",400);
   const {data,error}=await db.rpc("review_catalog_model",{job:input.jobId,item:item.id,actor:user.id,verdict:input.verdict});if(error||!data)return reply("MODEL_NOT_READY",409);
   return Response.json({saved:true},{headers:{"Cache-Control":"private, no-store"}});
  }else return reply("INVALID_REQUEST",400);
  after(async()=>{try{await inngest.send({name:"catalog/training.requested",data:{jobId}});}catch{console.error("Model preparation deferred",jobId);}});
  return Response.json({queued:true},{status:202,headers:{"Cache-Control":"private, no-store"}});
 }catch(e){return reply(e instanceof Error&&e.message==="PHOTO_SELECTION_INVALID"?e.message:"INVALID_REQUEST",400);}
}
