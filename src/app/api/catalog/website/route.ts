import {after} from "next/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {catalogOwner,catalogStoreOwner,catalogSameOrigin} from "@/lib/catalog/auth";
import {catalogBody} from "@/lib/catalog/security";
import {websiteOrigin} from "@/lib/catalog/website";
import {websiteStoresReady} from "@/lib/catalog/website-config";
import {inngest} from "@/inngest/client";
export async function POST(request:Request){
 const finish=(notice:string)=>Response.redirect("https://gooidy.com/dashboard/stores?notice="+notice,303);
 try{
  catalogSameOrigin(request);const form=new URLSearchParams((await catalogBody(request,16384)).toString()),ws=form.get("workspaceId"),action=form.get("action");
  if(action==="disconnect")await catalogOwner(ws);else await catalogStoreOwner(ws);
  if(action!=="disconnect"&&!websiteStoresReady())return finish("website_unavailable");
  const db=createAdminClient();
  const result=action==="connect"?await db.rpc("connect_website_store",{ws,origin:websiteOrigin(form.get("website"))}):["refresh","disconnect"].includes(action??"")?await db.rpc("manage_website_store",{ws,store_id:form.get("storeId"),operation:action}):null;
  if(!result||result.error||!result.data)throw new Error("CATALOG_STORE_SAVE_FAILED");
  if(action==="disconnect")return finish("website_disconnected");
  const store=result.data;after(async()=>{try{await inngest.send({name:"catalog/website.requested",data:{storeId:store.id,runId:store.run_id}});}catch{console.error("Website import deferred",store.id);}});
  return finish("website_syncing");
 }catch(e){return finish(e instanceof Error&&e.message==="CATALOG_UPGRADE_REQUIRED"?"upgrade":"website_error");}
}
