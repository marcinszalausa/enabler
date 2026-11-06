export type Training={id:string;status:"starting"|"processing"|"succeeded"|"failed"|"canceled";input?:Record<string,unknown>;output?:{version?:string};version?:string;created_at?:string};
const validId=(id:string)=>/^[a-z0-9]{10,80}$/.test(id);
export async function replicateRequest(path:string,method="GET",body?:unknown){
 const token=process.env.REPLICATE_API_TOKEN;if(!token)throw new Error("REPLICATE_NOT_CONFIGURED");
 const response=await fetch("https://api.replicate.com/v1/"+path,{method,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000),redirect:"error",cache:"no-store"});
 if(!response.ok)throw new Error("REPLICATE_REQUEST_FAILED");return response.json();
}
export function trainingTrigger(jobId:string){return "GDY"+jobId.replaceAll("-","").slice(0,16).toUpperCase();}
export async function readTraining(id:string):Promise<Training>{if(!validId(id))throw new Error("REPLICATE_ID_INVALID");return replicateRequest("trainings/"+id);}
export async function cancelTraining(id:string){if(!validId(id))throw new Error("REPLICATE_ID_INVALID");await replicateRequest("trainings/"+id+"/cancel","POST");}
export async function reconcileTraining(jobId:string):Promise<Training|null>{
 const data=await replicateRequest("trainings");const matches=(Array.isArray(data.results)?data.results:[]).filter((r:Training)=>r.input?.trigger_word===trainingTrigger(jobId));if(matches.length>1)throw new Error("REPLICATE_AMBIGUOUS_TRAINING");return matches[0]??null;
}
export async function createTraining(jobId:string,datasetUrl:string,destination:string,version:string):Promise<Training>{
 if(!/^[a-f0-9]{64}$/.test(version??"")||!/^[-a-z0-9_]+\/[-a-z0-9_]+$/.test(destination??""))throw new Error("REPLICATE_TRAINER_INVALID");
 const model=await replicateRequest("models/"+destination);if(model.visibility!=="private")throw new Error("REPLICATE_PRIVATE_DESTINATION_REQUIRED");
 return replicateRequest("models/replicate/fast-flux-trainer/versions/"+version+"/trainings","POST",{destination,input:{input_images:datasetUrl,trigger_word:trainingTrigger(jobId),lora_type:"subject",steps:1000,autocaption:true}});
}
