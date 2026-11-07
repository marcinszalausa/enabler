import "server-only";
import {createAdminClient} from "@/lib/supabase/admin";
import type {ReviewItem} from "./photo-access";
export type TrainingPhoto={key:string;url:string;path?:string};
export async function trainingPhotos(item:ReviewItem):Promise<TrainingPhoto[]>{
 const photos:TrainingPhoto[]=Array.isArray(item.images)?item.images.filter((u):u is string=>typeof u==="string").map((url,index)=>({key:"store:"+index,url})):[];
 const db=createAdminClient();const {data:uploads,error}=await db.from("catalog_training_photos").select("id,storage_path").eq("workspace_id",item.workspace_id).eq("item_id",item.id).order("created_at").limit(20);if(error)throw new Error("TRAINING_PHOTOS_READ_FAILED");
 for(const photo of uploads??[]){const {data,error:sign}=await db.storage.from("catalog-photos").createSignedUrl(photo.storage_path,3600);if(sign||!data)throw new Error("TRAINING_PHOTO_SIGN_FAILED");photos.push({key:"upload:"+photo.id,url:data.signedUrl,path:photo.storage_path});}return photos;
}
