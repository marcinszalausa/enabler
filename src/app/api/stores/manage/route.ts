import {after} from "next/server";
import {catalogBody} from "@/lib/catalog/security";
import {catalogOwner,catalogStoreOwner,catalogSameOrigin} from "@/lib/catalog/auth";
import {createAdminClient} from "@/lib/supabase/admin";
import {inngest} from "@/inngest/client";
export async function POST(request:Request){
 const finish=(notice:string)=>Response.redirect("https://gooidy.com/dashboard/stores?notice="+notice,303);
 try{
  catalogSameOrigin(request);const form=new URLSearchParams((await catalogBody(request,16384)).toString()),ws=form.get("workspaceId"),action=form.get("action");
  if(action==="disconnect")await catalogOwner(ws);else await catalogStoreOwner(ws);
  if(!["refresh","disconnect"].includes(String(action)))throw new Error("STORE_ACTION_INVALID");
  const {data:store,error}=await createAdminClient().rpc("manage_platform_store",{ws,store_id:form.get("storeId"),operation:action});if(error||!store)throw new Error("STORE_SAVE_FAILED");
  if(action==="disconnect")return finish("platform_disconnected");
  after(async()=>{try{await inngest.send({name:"store/catalog.requested",data:{storeId:store.id,runId:store.run_id}});}catch{console.error("Store catalog deferred",store.id);}});
  return finish("platform_syncing");
 }catch(e){return finish(e instanceof Error&&e.message==="CATALOG_UPGRADE_REQUIRED"?"upgrade":"platform_error");}
}
