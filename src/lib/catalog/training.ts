import "server-only";
import {createAdminClient} from "@/lib/supabase/admin";
import {createTraining,readTraining,cancelTraining,reconcileTraining} from "./replicate";
import {jobStatus} from "./store";
import {trainingAllowed} from "./security";
import {trainingSetup} from "./training-policy";
async function loadJob(id:string){const db=createAdminClient();const {data,error}=await db.from("catalog_training_jobs").select("*,catalog_items(product_url,connection_id)").eq("id",id).single();if(error||!data)throw new Error("CATALOG_JOB_NOT_FOUND");return data;}
export async function submitCatalogTraining(id:string){
 const db=createAdminClient(),job=await loadJob(id);
 if(job.provider_training_id)return {submitted:true,unknown:false};
 if(["submitting","submission_unknown"].includes(job.status))return {submitted:false,unknown:true};
 if(job.status!=="dataset_ready"||!trainingAllowed(job.workspace_id,job.catalog_items.product_url))return {submitted:false,unknown:false};
 if(!trainingSetup().spendingEnabled||!job.training_requested_at||!job.source_reviewed_at||!job.consent_user_id)return {submitted:false,unknown:false};
 const {data:connection}=await db.from("catalog_connections").select("enabled").eq("id",job.catalog_items.connection_id).single();if(!connection?.enabled)return {submitted:false,unknown:false};
 const {data:signed,error:signError}=await db.storage.from("catalog-training").createSignedUrl(job.dataset_path,3600);if(signError||!signed?.signedUrl)throw new Error("CATALOG_DATASET_SIGN_FAILED");
 const {data:claimed,error}=await db.rpc("claim_catalog_training",{job:id});if(error)throw new Error("CATALOG_CLAIM_FAILED");if(!claimed)return {submitted:false,unknown:false};
 try{
  const result=await createTraining(id,signed.signedUrl,job.destination,job.trainer_version);
  if(!/^[a-z0-9]{10,80}$/.test(result.id))throw new Error("REPLICATE_RESPONSE_INVALID");
  await jobStatus(id,{provider_training_id:result.id,status:"running",error_code:null});
  return {submitted:true,unknown:false};
 }catch{
  // The provider might have accepted the paid request. Never POST again on a retry.
  const {error:saveError}=await db.from("catalog_training_jobs").update({status:"submission_unknown",error_code:"PROVIDER_SUBMISSION_REQUIRES_RECONCILIATION"}).eq("id",id).is("provider_training_id",null);
  if(saveError)throw new Error("CATALOG_SUBMISSION_STATE_WRITE_FAILED");return {submitted:false,unknown:true};
 }
}
export async function pollCatalogTraining(id:string){
 const db=createAdminClient();let job=await loadJob(id);
 if(["succeeded","failed","canceled","blocked"].includes(job.status))return {terminal:true,status:job.status};
 if(!job.provider_training_id){
  if(!["submitting","submission_unknown"].includes(job.status))return {terminal:false,status:job.status};
  const found=await reconcileTraining(id);if(!found||found.version!==job.trainer_version)return {terminal:false,status:"submission_unknown"};
  await jobStatus(id,{provider_training_id:found.id,status:"running",error_code:null});job=await loadJob(id);
 }
 const result=await readTraining(job.provider_training_id);
 if(result.status==="succeeded"){
  const version=result.output?.version;
  if(typeof version!=="string"||!/^[-a-z0-9_]+\/[-a-z0-9_]+:[a-f0-9]{64}$/.test(version)||version.split(":")[0]!==job.destination){await jobStatus(id,{status:"failed",error_code:"INCOMPATIBLE_OR_MISSING_TRAINED_VERSION",finished_at:new Date().toISOString()});return {terminal:true,status:"failed"};}
  await jobStatus(id,{status:"succeeded",candidate_version:version,review_status:"pending",finished_at:new Date().toISOString(),error_code:null});return {terminal:true,status:"awaiting_review"};
 }
 if(result.status==="failed"||result.status==="canceled"){await jobStatus(id,{status:result.status,finished_at:new Date().toISOString(),error_code:result.status==="failed"?"PROVIDER_TRAINING_FAILED":null});return {terminal:true,status:result.status};}
 const {data:connection}=await db.from("catalog_connections").select("enabled").eq("id",job.catalog_items.connection_id).single();
 if(!connection?.enabled||!trainingSetup().spendingEnabled||!trainingAllowed(job.workspace_id,job.catalog_items.product_url)||!job.submitted_at||Date.now()-Date.parse(job.submitted_at)>600000){await cancelTraining(job.provider_training_id);await jobStatus(id,{status:"cancel_pending",error_code:"CANCELLATION_AWAITING_PROVIDER_CONFIRMATION"});return {terminal:false,status:"cancel_pending"};}
 return {terminal:false,status:"running"};
}
