import {requireStorePlan} from "@/lib/catalog/access";
import {after} from "next/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {catalogBody} from "@/lib/catalog/security";
import {catalogOwner,catalogSameOrigin} from "@/lib/catalog/auth";
import {shopifyConfigured} from "@/lib/shopify/security";
import {storeToken,graph} from "@/lib/shopify/api";
import {inngest} from "@/inngest/client";
export const maxDuration=60;
export async function POST(request:Request){
 const finish=(notice:string)=>Response.redirect("https://gooidy.com/dashboard/stores?notice="+notice,303);
 if(process.env.VERCEL_ENV!=="production")return finish("unavailable");
 try{
  catalogSameOrigin(request);const form=new URLSearchParams((await catalogBody(request,16384)).toString()),workspaceId=form.get("workspaceId"),id=form.get("storeId"),action=form.get("action");
  await catalogOwner(workspaceId);if(typeof id!=="string"||!["sync","disconnect"].includes(String(action)))throw new Error("INVALID");
  const db=createAdminClient();const {data:store,error}=await db.from("shopify_stores").select("id,shop,status,connection_id,installation_id").eq("id",id).eq("workspace_id",workspaceId).single();if(error||!store)throw new Error("INVALID");
  if(action==="disconnect"){
   let token:string|null=null;
   if(store.status!=="disconnected")try{token=(await storeToken(id,store.installation_id)).token;}catch{}
   const {data:disconnected,error:disabled}=await db.rpc("disconnect_shopify_store",{store_id:id,install:store.installation_id});if(disabled||disconnected!==true)throw new Error("DISCONNECT");
   if(store.status==="disconnected")return finish("disconnected");
   if(token)try{
    const result=await graph<{appUninstall:{userErrors:unknown[]}}>(store.shop,token,"mutation {appUninstall {userErrors {field message}}}");
    if(!result.appUninstall.userErrors.length)return finish("disconnected");
   }catch{}
   return finish("disconnected_local");
  }
  await requireStorePlan(String(workspaceId));
  if(!shopifyConfigured())return finish("unavailable");
  if(store.status==="syncing")return finish("syncing");
  if(["disconnected","reconnect"].includes(store.status))return finish("reconnect");
  const {error:enable}=await db.from("catalog_connections").update({enabled:true}).eq("id",store.connection_id);if(enable)throw new Error("SYNC");
  const {error:update}=await db.from("shopify_stores").update({status:"syncing",sync_cursor:null,sync_started_at:new Date().toISOString(),error_code:null}).eq("id",id).eq("installation_id",store.installation_id);if(update)throw new Error("SYNC");
  after(async()=>{try{await inngest.send({name:"shopify/sync.requested",data:{storeId:id,installationId:store.installation_id}});}catch{console.error("Shopify sync deferred",id);}});
  return finish("syncing");
 }catch(e){return finish(e instanceof Error&&e.message==="CATALOG_UPGRADE_REQUIRED"?"upgrade":"action_error");}
}
