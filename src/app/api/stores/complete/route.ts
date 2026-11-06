import {cookies} from "next/headers";
import {after} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {catalogStoreOwner} from "@/lib/catalog/auth";
import {intentHash,STORE_COOKIE} from "@/lib/stores/providers";
import {inngest} from "@/inngest/client";
export async function GET(request:Request){
 const finish=(notice:string)=>Response.redirect("https://gooidy.com/dashboard/stores?notice="+notice,303);
 try{
  const params=new URL(request.url).searchParams,jar=await cookies(),state=jar.get(STORE_COOKIE)?.value??"";
  if(!/^[a-f0-9]{64}$/.test(state))throw new Error("STORE_STATE_INVALID");
  const claim=params.get("claim"),receipt=params.get("receipt"),hash=claim&&/^[a-f0-9]{64}$/.test(claim)?intentHash(claim):receipt&&/^[a-f0-9]{64}$/.test(receipt)?receipt:null;if(!hash)throw new Error("STORE_STATE_INVALID");
  const {data:{user},error:authError}=await (await createClient()).auth.getUser();if(authError||!user)throw new Error("AUTH");
  const db=createAdminClient();const {data:pending,error}=await db.from("store_connect_intents").select("workspace_id").eq("state_hash",intentHash(state)).eq("user_id",user.id).gt("expires_at",new Date().toISOString()).single();if(error||!pending)throw new Error("STORE_STATE_INVALID");
  await catalogStoreOwner(pending.workspace_id);
  const {data:store,error:install}=await db.rpc("finish_store_connection",{intent:intentHash(state),receipt:hash,actor:user.id});if(install||!store)throw new Error("STORE_INSTALL_FAILED");
  jar.delete(STORE_COOKIE);
  after(async()=>{try{await inngest.send({name:"store/catalog.requested",data:{storeId:store.id,runId:store.run_id}});}catch{console.error("Store catalog deferred",store.id);}});
  return finish("platform_connected");
 }catch(e){return finish(e instanceof Error&&e.message==="CATALOG_UPGRADE_REQUIRED"?"upgrade":"platform_error");}
}
