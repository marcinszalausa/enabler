import "server-only";
import {createAdminClient} from "@/lib/supabase/admin";
import {replicateRequest,trainingTrigger} from "./replicate";
import {trainingSetup} from "./training-policy";
import {trainingAllowed} from "./security";
export type CatalogModel={jobId:string;version:string};
export async function approvedCatalogModel(workspaceId:string,productId:string):Promise<CatalogModel|null>{
 if(process.env.CATALOG_MODEL_INFERENCE_ENABLED!=="true"||!trainingSetup().spendingEnabled)return null;
 const db=createAdminClient();const {data:p,error}=await db.from("products").select("url").eq("id",productId).eq("workspace_id",workspaceId).maybeSingle();if(error)throw new Error("MODEL_PRODUCT_READ_FAILED");if(!p||!trainingAllowed(workspaceId,p.url))return null;
 const {data:items,error:read}=await db.from("catalog_items").select("id,image_revision,catalog_connections!inner(enabled)").eq("workspace_id",workspaceId).eq("product_url",p.url).eq("catalog_connections.enabled",true);if(read)throw new Error("MODEL_SOURCE_READ_FAILED");
 for(const item of items??[]){const {data:jobs,error}=await db.from("catalog_training_jobs").select("id,candidate_version").eq("workspace_id",workspaceId).eq("item_id",item.id).eq("source_revision",item.image_revision).eq("status","succeeded").eq("review_status","approved").order("finished_at",{ascending:false}).limit(1);if(error)throw new Error("MODEL_VERSION_READ_FAILED");const j=jobs?.[0];if(j?.candidate_version)return {jobId:j.id,version:j.candidate_version};}return null;
}
export async function generateCatalogModelImage(model:CatalogModel,prompt:string,aspect:string){
 if(process.env.CATALOG_MODEL_INFERENCE_ENABLED!=="true"||!trainingSetup().spendingEnabled||!/^[-a-z0-9_]+\/[-a-z0-9_]+:[a-f0-9]{64}$/.test(model.version))throw new Error("MODEL_INFERENCE_UNAVAILABLE");
 const result=await replicateRequest("predictions","POST",{version:model.version.split(":")[1],input:{prompt:"An advertising photograph featuring "+trainingTrigger(model.jobId)+". "+prompt,aspect_ratio:aspect,num_outputs:1,output_format:"jpg"}});
 if(!/^[a-z0-9]{10,80}$/.test(result.id))throw new Error("MODEL_INFERENCE_RESPONSE_INVALID");
 for(let i=0;i<30;i++){
  const state=await replicateRequest("predictions/"+result.id);
  if(state.status==="succeeded"){const output=Array.isArray(state.output)?state.output[0]:state.output;if(typeof output!=="string")throw new Error("MODEL_INFERENCE_OUTPUT_INVALID");return output;}
  if(["failed","canceled"].includes(state.status))throw new Error("MODEL_INFERENCE_FAILED");await new Promise(r=>setTimeout(r,2000));
 }
 await replicateRequest("predictions/"+result.id+"/cancel","POST");throw new Error("MODEL_INFERENCE_TIMEOUT");
}
