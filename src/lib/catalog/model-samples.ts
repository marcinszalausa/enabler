import "server-only";
import sharp from "sharp";
import {createAdminClient} from "@/lib/supabase/admin";
import {replicateRequest,trainingTrigger} from "./replicate";
import {trainingAllowed} from "./security";
import {trainingSetup,MODEL_REVIEW_SCENES} from "./training-policy";
import {fetchPublicUrl} from "@/lib/public-fetch";
export async function advanceModelSamples(jobId:string){
 const db=createAdminClient();const {data:job,error}=await db.from("catalog_training_jobs").select("*,catalog_items!inner(product_url)").eq("id",jobId).single();
 if(error||!job)throw new Error("MODEL_JOB_MISSING");
 if(job.status!=="succeeded"||!job.candidate_version||!trainingSetup().spendingEnabled||!trainingAllowed(job.workspace_id,job.catalog_items.product_url))return {done:true,disabled:true};
 if(!/^[-a-z0-9_]+\/[-a-z0-9_]+:[a-f0-9]{64}$/.test(job.candidate_version)||job.candidate_version.split(":")[0]!==job.destination)throw new Error("MODEL_VERSION_INVALID");
 for(let scenario=0;scenario<MODEL_REVIEW_SCENES.length;scenario++){
  const {error:reserve}=await db.from("catalog_model_samples").upsert({workspace_id:job.workspace_id,job_id:jobId,scenario},{onConflict:"job_id,scenario",ignoreDuplicates:true});if(reserve)throw new Error("MODEL_SAMPLE_RESERVE_FAILED");
 }
 const {data:samples,error:read}=await db.from("catalog_model_samples").select("*").eq("job_id",jobId).eq("workspace_id",job.workspace_id).order("scenario");if(read)throw new Error("MODEL_SAMPLE_READ_FAILED");
 let pending=false;
 for(const sample of samples??[]){
  if(["succeeded","failed","unknown"].includes(sample.status))continue;
  if(sample.status==="submitting"&&!sample.prediction_id){const {error}=await db.from("catalog_model_samples").update({status:"unknown",error_code:"PROVIDER_SUBMISSION_REQUIRES_RECONCILIATION"}).eq("id",sample.id).eq("status","submitting");if(error)throw new Error("MODEL_SAMPLE_SAVE_FAILED");continue;}
  let prediction=sample.prediction_id;
  if(sample.status==="queued"){
   const {data:claim,error:claimed}=await db.from("catalog_model_samples").update({status:"submitting"}).eq("id",sample.id).eq("status","queued").select("id").maybeSingle();if(claimed)throw new Error("MODEL_SAMPLE_CLAIM_FAILED");if(!claim){pending=true;continue;}
   try{
    const result=await replicateRequest("predictions","POST",{version:job.candidate_version.split(":")[1],input:{prompt:"Product photo of "+trainingTrigger(jobId)+". "+MODEL_REVIEW_SCENES[sample.scenario]+" No captions, watermarks or invented branding.",aspect_ratio:"1:1",num_outputs:1,output_format:"jpg"}});
    if(!/^[a-z0-9]{10,80}$/.test(result.id))throw new Error("MODEL_SAMPLE_RESPONSE_INVALID");prediction=result.id;
    const {error:save}=await db.from("catalog_model_samples").update({prediction_id:prediction,status:"running"}).eq("id",sample.id);if(save)throw new Error("MODEL_SAMPLE_SAVE_FAILED");
   }catch{const {error:save}=await db.from("catalog_model_samples").update({status:"unknown",error_code:"PROVIDER_SUBMISSION_REQUIRES_RECONCILIATION"}).eq("id",sample.id).is("prediction_id",null);if(save)throw new Error("MODEL_SAMPLE_SAVE_FAILED");continue;}
  }
  if(!prediction){pending=true;continue;}
  const result=await replicateRequest("predictions/"+prediction);
  if(result.status==="succeeded"){
   const url=Array.isArray(result.output)?result.output[0]:result.output;if(typeof url!=="string")throw new Error("MODEL_SAMPLE_OUTPUT_INVALID");
   const image=await fetchPublicUrl(url,{maxBytes:8*1024*1024,timeoutMs:15000,accept:"image/*"});if(image.status!==200)throw new Error("MODEL_SAMPLE_DOWNLOAD_FAILED");
   const source=sharp(image.body,{limitInputPixels:32000000,animated:false}),meta=await source.metadata();if(!meta.width||!meta.height||Math.min(meta.width,meta.height)<768||(meta.pages??1)>1)throw new Error("MODEL_SAMPLE_IMAGE_INVALID");
   const jpeg=await source.rotate().jpeg({quality:95}).toBuffer(),path=job.workspace_id+"/"+jobId+"/"+sample.scenario+".jpg";
   const {error:upload}=await db.storage.from("catalog-model-review").upload(path,new Uint8Array(jpeg),{contentType:"image/jpeg",upsert:true});if(upload)throw new Error("MODEL_SAMPLE_STORAGE_FAILED");
   const {error:save}=await db.from("catalog_model_samples").update({status:"succeeded",storage_path:path,error_code:null}).eq("id",sample.id);if(save)throw new Error("MODEL_SAMPLE_SAVE_FAILED");
  }else if(["failed","canceled"].includes(result.status)){
   const {error:save}=await db.from("catalog_model_samples").update({status:"failed",error_code:"PROVIDER_SAMPLE_FAILED"}).eq("id",sample.id);if(save)throw new Error("MODEL_SAMPLE_SAVE_FAILED");
  }else pending=true;
 }
 return {done:!pending};
}
