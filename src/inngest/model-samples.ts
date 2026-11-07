import {inngest} from "./client";
import {advanceModelSamples} from "@/lib/catalog/model-samples";
export const reviewModelSamples=inngest.createFunction({id:"catalog-model-review-samples",triggers:{event:"catalog/model.samples"},retries:3,concurrency:{limit:1}},async({event,step})=>{
 const id=String(event.data.jobId??"");if(!/^[a-f0-9-]{36}$/.test(id))throw new Error("MODEL_JOB_INVALID");
 for(let i=0;i<20;i++){const state=await step.run("advance-"+i,()=>advanceModelSamples(id));if(state.done)return state;await step.sleep("wait-"+i,"15s");}return {waiting:true};
});
