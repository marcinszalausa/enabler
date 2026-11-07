import {inngest} from "./client";
import {createAdminClient} from "@/lib/supabase/admin";
import {catalogEnabled,trainingAllowed} from "@/lib/catalog/security";
import {prepareTrainingDataset} from "@/lib/catalog/dataset";
import {submitCatalogTraining,pollCatalogTraining} from "@/lib/catalog/training";
import {dispatchStockPauses} from "@/lib/catalog/stock-dispatch";
export const applyCatalog=inngest.createFunction({id:"catalog-apply-delivery",triggers:{event:"catalog/delivery.received"},retries:3,concurrency:{limit:4}},async({event,step})=>{
 const jobs=await step.run("apply-and-reserve",async()=>{
  if(!catalogEnabled())return [];
  const db=createAdminClient();const id=String(event.data.deliveryId??"");if(!/^[a-f0-9-]{36}$/.test(id))throw new Error("CATALOG_DELIVERY_INVALID");
  const {error}=await db.rpc("apply_catalog_delivery",{delivery:id});if(error)throw new Error("CATALOG_DELIVERY_APPLY_FAILED");
  const {data:receipt,error:read}=await db.from("catalog_deliveries").select("connection_id,workspace_id,products").eq("id",id).single();if(read||!receipt)throw new Error("CATALOG_RECEIPT_READ_FAILED");
  await dispatchStockPauses(receipt.connection_id);
  const ids=Array.isArray(receipt.products)?receipt.products.map(p=>p.externalId):[];
  const {data:items,error:itemsError}=await db.from("catalog_items").select("id,workspace_id,product_url,image_revision").eq("connection_id",receipt.connection_id).in("external_id",ids);if(itemsError)throw new Error("CATALOG_ITEMS_READ_FAILED");
  const pending:string[]=[];
  for(const item of items??[]){if(!trainingAllowed(item.workspace_id,item.product_url))continue;
   const {error:insert}=await db.from("catalog_training_jobs").upsert({workspace_id:item.workspace_id,item_id:item.id,image_revision:item.image_revision,trainer_version:process.env.REPLICATE_TRAINER_VERSION,destination:process.env.REPLICATE_TRAINING_DESTINATION},{onConflict:"item_id,image_revision,trainer_version",ignoreDuplicates:true});if(insert)throw new Error("CATALOG_JOB_RESERVE_FAILED");
   const {data:job,error:lookup}=await db.from("catalog_training_jobs").select("id,status").eq("item_id",item.id).eq("image_revision",item.image_revision).eq("trainer_version",process.env.REPLICATE_TRAINER_VERSION!).single();if(lookup)throw new Error("CATALOG_JOB_READ_FAILED");if(job&&["queued","dataset_ready"].includes(job.status))pending.push(job.id);
  }return pending;
 });
 if(jobs.length)await step.sendEvent("dispatch-training",jobs.map(jobId=>({id:"catalog-training-"+jobId,name:"catalog/training.requested",data:{jobId}})));
 return {jobs:jobs.length};
});
export const trainCatalog=inngest.createFunction({id:"catalog-train-product",triggers:{event:"catalog/training.requested"},retries:3,concurrency:{limit:1}},async({event,step})=>{
 const id=String(event.data.jobId??"");if(!/^[a-f0-9-]{36}$/.test(id))throw new Error("CATALOG_JOB_INVALID");
 const ready=await step.run("prepare-private-dataset",()=>prepareTrainingDataset(id));if(!ready)return {status:"blocked_or_disabled"};
 const submitted=await step.run("submit-once",()=>submitCatalogTraining(id));if(!submitted.submitted)return {status:submitted.unknown?"submission_unknown":"waiting_for_allowance"};
 for(let i=0;i<22;i++){await step.sleep("wait-"+i,"30s");const state=await step.run("poll-"+i,()=>pollCatalogTraining(id));if(state.terminal){if(state.status==="awaiting_review")await step.sendEvent("review-model-samples",{name:"catalog/model.samples",data:{jobId:id}});return state;}}
 return {status:"awaiting_reconciliation"};
});
export const reconcileCatalog=inngest.createFunction({id:"catalog-reconcile-outbox",triggers:{cron:"*/5 * * * *"},retries:3,concurrency:{limit:1}},async({step})=>{
 const pending=await step.run("read-pending",async()=>{
  if(!catalogEnabled())return {deliveries:[],jobs:[],active:[]};
  const db=createAdminClient();const [deliveries,jobs,active]=await Promise.all([db.from("catalog_deliveries").select("id").eq("status","pending").order("received_at").limit(25),db.from("catalog_training_jobs").select("id").in("status",["queued","dataset_ready"]).order("created_at").limit(5),db.from("catalog_training_jobs").select("id").in("status",["submitting","submission_unknown","running","cancel_pending"]).order("created_at").limit(5)]);
  if(deliveries.error||jobs.error||active.error)throw new Error("CATALOG_OUTBOX_READ_FAILED");return {deliveries:deliveries.data??[],jobs:jobs.data??[],active:active.data??[]};
 });
 const bucket=Math.floor(Date.now()/300000);
 const events=[...pending.deliveries.map(d=>({id:"catalog-recovery-"+d.id+"-"+bucket,name:"catalog/delivery.received",data:{deliveryId:d.id}})),...pending.jobs.map(j=>({id:"training-recovery-"+j.id+"-"+bucket,name:"catalog/training.requested",data:{jobId:j.id}}))];
 if(events.length)await step.sendEvent("recover-dispatch",events);
 for(const job of pending.active){const result=await step.run("reconcile-"+job.id,()=>pollCatalogTraining(job.id));if(result.status==="awaiting_review")await step.sendEvent("review-"+job.id,{name:"catalog/model.samples",data:{jobId:job.id}});}
 const reviews=await step.run("pending-model-reviews",async()=>{const {data,error}=await createAdminClient().from("catalog_training_jobs").select("id,catalog_model_samples(status)").eq("status","succeeded").eq("review_status","pending").not("source_reviewed_at","is",null).limit(10);if(error)throw new Error("MODEL_REVIEW_RECOVERY_FAILED");return (data??[]).filter(j=>j.catalog_model_samples.length<3||j.catalog_model_samples.some(s=>["queued","submitting","running"].includes(s.status)));});
 if(reviews.length)await step.sendEvent("recover-review-samples",reviews.map(j=>({id:"model-review-"+j.id+"-"+bucket,name:"catalog/model.samples",data:{jobId:j.id}})));
 return {dispatched:events.length,reconciled:pending.active.length};
});
