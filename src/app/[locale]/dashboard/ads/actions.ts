"use server";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {requestMessages} from "@/i18n/server";
export type FavoriteState={favorite:boolean;error:string|null};
export async function setFavorite(previous:FavoriteState,form:FormData):Promise<FavoriteState>{
 const t=await requestMessages();
 const id=form.get("creativeId"),wanted=form.get("favorite");
 if(typeof id!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)||(wanted!=="1"&&wanted!=="0"))return {...previous,error:t.library.saveError};
 const client=await createClient();
 const {data:auth,error:authError}=await client.auth.getUser();
 if(authError||!auth.user)return {...previous,error:t.library.saveError};
 const {data:creative,error:creativeError}=await client.from("creatives").select("id").eq("id",id).maybeSingle();
 if(creativeError||!creative)return {...previous,error:t.library.saveError};
 const result=wanted==="1"
  ?await client.from("creative_favorites").upsert({user_id:auth.user.id,creative_id:id},{onConflict:"user_id,creative_id",ignoreDuplicates:true})
  :await client.from("creative_favorites").delete().eq("user_id",auth.user.id).eq("creative_id",id);
 if(result.error)return {...previous,error:t.library.saveError};
 revalidatePath("/dashboard/ads");
 return {favorite:wanted==="1",error:null};
}
