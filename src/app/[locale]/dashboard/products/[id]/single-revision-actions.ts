"use server";
import {after} from "next/server";
import {maybeAutoReload} from "@/lib/auto-reload";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {canEditWorkspace,WORKSPACE_WRITE_DENIED} from "@/lib/workspace-access";
import {parseCreativeRevision,REVISION_UUID} from "@/lib/creative-revision";
import {parseBrandMemory,parseCampaign} from "@/lib/customer-workflow";
import {parseCreativePreferences} from "@/lib/creative-preferences";
import {isQuality,IMAGE_CREDITS} from "@/lib/quality";
import {parseVideoOptions,creditsPerVideo} from "@/lib/video-options";
import {DEFAULT_LANGUAGE,isLanguageKey} from "@/lib/languages";
import {runGeneration} from "@/lib/pipeline";
import {runVideoGeneration} from "@/lib/video";
export type SingleRevisionState={error:string|null;started:boolean};
export async function startSingleRevision(_previous:SingleRevisionState,form:FormData):Promise<SingleRevisionState>{
 const no=(error:string)=>({error,started:false});
 const sourceId=String(form.get("creativeId")??""),requestId=String(form.get("requestId")??""),direction=String(form.get("direction")??"").trim(),quality=form.get("quality");
 if(!REVISION_UUID.test(sourceId)||!REVISION_UUID.test(requestId)||!direction||direction.length>240||!isQuality(quality)||form.get("confirmed")!=="yes")return no("Choose a direction and confirm the displayed credit cost.");
 const db=await createClient();const {data:auth}=await db.auth.getUser();if(!auth.user)return no("Sign in again before creating a revision.");
 const {data:source,error:sourceError}=await db.from("creatives").select("id,workspace_id,kind,aspect,storage_path,headline,primary_text,cta,angle,generations!inner(product_id,status,request_options)").eq("id",sourceId).maybeSingle();
 if(sourceError||!source)return no("This ad could not be loaded.");
 if(!(await canEditWorkspace(db,source.workspace_id)))return no(WORKSPACE_WRITE_DENIED);
 const run=source.generations as unknown as {product_id:string;status:string;request_options:Record<string,unknown>|null};
 if(run.status!=="succeeded")return no("Wait for the original batch to finish before revising this ad.");
 const revision=parseCreativeRevision({version:1,source_id:source.id,kind:source.kind,aspect:source.aspect,storage_path:source.storage_path,direction,headline:source.headline??"",primary_text:source.primary_text??"",cta:source.cta??"Shop now",angle:source.angle??"benefit"});
 if(!revision||!revision.storage_path.startsWith(source.workspace_id+"/"))return no("This ad cannot be used as a revision source.");
 const video=revision.kind==="video",original=run.request_options??{};
 const videoForm=new FormData();for(const key of ["message","language","gender","accent","energy","person"]){if(typeof original[key]==="string")videoForm.set(key,original[key] as string);}
 videoForm.set("quality",quality);videoForm.set("length",String(form.get("length")??"7"));const options=video?parseVideoOptions(videoForm):null;
 const language=options?.language??(isLanguageKey(original.language)?original.language:DEFAULT_LANGUAGE);
 const cost=options?creditsPerVideo(options.length,quality):IMAGE_CREDITS[quality];
 if(form.get("quotedCost")!==String(cost))return no("The price changed. Refresh and review the credit cost before continuing.");
 const creativePreferences=parseCreativePreferences(original.creative_preferences);
 const campaign=parseCampaign(original.campaign);
 const freeRedo=!video&&form.get("freeRedo")==="yes";
 const snapshot={...(freeRedo?{free_redo:true}:{}),...(campaign?{campaign}:{}),...(options??{quality,language}),...(creativePreferences?{creative_preferences:creativePreferences}:{}),brand_memory:parseBrandMemory(original.brand_memory),revision};
 const model=`single revision ${revision.kind} ${quality}`,admin=createAdminClient();
 const {data:generationId,error}=freeRedo
  ?await admin.rpc("reserve_free_redo",{ws:source.workspace_id,request_id:requestId,product:run.product_id,generation_model:model,amount:cost,options:snapshot})
  :await admin.rpc("reserve_generation",{ws:source.workspace_id,request_id:requestId,product:run.product_id,generation_type:video?"video_ads":"image_ads",generation_model:model,amount:cost,options:snapshot});
 if(error){console.error("reserve single revision failed",error.code);return no(error.message==="FREE_REDO_LIMIT"?"You’ve used this month’s 3 free redos. Untick the box to recreate it with credits.":error.message==="TRIAL_BATCH_ACTIVE"?"Let your current batch finish before creating a revision.":error.message==="TRIAL_BATCH_RATE"?"You have reached the hourly generation limit. Try again later.":"We couldn’t start this revision. Refresh and try again.");}
 after(()=>maybeAutoReload(source.workspace_id));
 if(!generationId)return no(`This revision needs ${cost} credits. Check your balance before trying again.`);
 const job={generationId:String(generationId),workspaceId:source.workspace_id,productId:run.product_id,creativePreferences};
 after(()=>options?runVideoGeneration({...job,options}):runGeneration({...job,language,quality}));
 revalidatePath(`/dashboard/products/${run.product_id}`);revalidatePath("/dashboard/ads");return {error:null,started:true};
}
