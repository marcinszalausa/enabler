import {inngest} from "./client";
import {createAdminClient} from "@/lib/supabase/admin";
import {storeToken,graph} from "@/lib/shopify/api";
import {shopifyConfigured} from "@/lib/shopify/security";
import {canonicalProduct} from "@/lib/catalog/normalize";
import {receiveCatalog,loadConnection} from "@/lib/catalog/store";
import {createHash} from "node:crypto";
type ProductPage={products:{nodes:{id:string;handle:string;title:string;updatedAt:string;images:{nodes:{url:string}[]}}[];pageInfo:{hasNextPage:boolean;endCursor:string|null}}};
export async function syncShopifyPage(storeId:string,installationId:string){
 const db=createAdminClient(),auth=await storeToken(storeId,installationId),store=auth.store;
 if(store.status!=="syncing")return {done:true};
 const c=await loadConnection(store.connection_id);
 const page=await graph<ProductPage>(store.shop,auth.token,`query Catalog($after:String){products(first:20,after:$after,query:"status:active",sortKey:ID){nodes{id handle title updatedAt images(first:30){nodes{url}}}pageInfo{hasNextPage endCursor}}}`,{after:store.sync_cursor});
 const products=page.products.nodes.map(p=>canonicalProduct({externalId:p.id.split("/").pop(),name:p.title,url:c.store_origin+"/products/"+encodeURIComponent(p.handle),images:p.images.nodes.map(i=>i.url),inventoryQuantity:null,updatedAt:p.updatedAt},c));
 if(products.length){
  const body=Buffer.from(JSON.stringify(products)),hash=createHash("sha256").update(body).digest("hex");
  const delivery=await receiveCatalog(c,"shopify-import:"+installationId+":"+hash,body,products);
  const {error}=await db.rpc("apply_catalog_delivery",{delivery});if(error)throw new Error("SHOPIFY_IMPORT_FAILED");
 }
 const done=!page.products.pageInfo.hasNextPage;
 if(!done&&(!page.products.pageInfo.endCursor||page.products.pageInfo.endCursor===store.sync_cursor))throw new Error("SHOPIFY_CURSOR_INVALID");
 const {error}=await db.from("shopify_stores").update({sync_cursor:page.products.pageInfo.endCursor,status:done?"connected":"syncing",synced_at:done?new Date().toISOString():null,error_code:null}).eq("id",storeId).eq("installation_id",installationId).eq("status","syncing");
 if(error)throw new Error("SHOPIFY_IMPORT_SAVE_FAILED");return {done};
}
export const syncShopify=inngest.createFunction({id:"shopify-sync-catalog",triggers:{event:"shopify/sync.requested"},retries:3,concurrency:{limit:1},onFailure:async({event})=>{const data=event.data.event.data;const {error}=await createAdminClient().from("shopify_stores").update({status:"error",error_code:"SHOPIFY_SYNC_INTERRUPTED"}).eq("id",String(data.storeId)).eq("installation_id",String(data.installationId)).eq("status","syncing");if(error)throw new Error("SHOPIFY_STATE_SAVE_FAILED");}},async({event,step})=>{
 const id=String(event.data.storeId??""),install=String(event.data.installationId??"");if(!/^[a-f0-9-]{36}$/.test(id)||!/^[a-f0-9-]{36}$/.test(install))throw new Error("SHOPIFY_STORE_INVALID");
 if(!shopifyConfigured())return {disabled:true};
 // Bounded chunk; recovery resumes the persisted cursor for larger catalogs.
 for(let page=0;page<50;page++){
  try{const result=await step.run("page-"+page,()=>syncShopifyPage(id,install));if(result.done)return {done:true};}
  catch(e){
   const code=e instanceof Error?e.message:"SHOPIFY_SYNC_FAILED";
   if(code==="CATALOG_UPGRADE_REQUIRED")return {upgradeRequired:true};
   if(code==="SHOPIFY_RECONNECT_REQUIRED"){
    await step.run("require-reconnection",async()=>{const {error}=await createAdminClient().from("shopify_stores").update({status:"reconnect",error_code:code}).eq("id",id).eq("installation_id",install).neq("status","disconnected");if(error)throw new Error("SHOPIFY_STATE_SAVE_FAILED");});return {reconnect:true};
   }throw e;
  }
  await step.sleep("rate-limit-"+page,"2s");
 }return {resumable:true};
});
export const recoverShopify=inngest.createFunction({id:"shopify-recover-sync",triggers:{cron:"*/5 * * * *"},retries:3,concurrency:{limit:1}},async({step})=>{
 if(!shopifyConfigured())return {disabled:true};
 const pending=await step.run("pending-stores",async()=>{
  const db=createAdminClient();
  const {error:cleanup}=await db.from("shopify_oauth_states").delete().lt("expires_at",new Date().toISOString());if(cleanup)throw new Error("SHOPIFY_STATE_CLEANUP_FAILED");
  const {data,error}=await db.from("shopify_stores").select("id,installation_id").eq("status","syncing").order("sync_started_at").limit(25);if(error)throw new Error("SHOPIFY_RECOVERY_FAILED");return data??[];
 });
 if(pending.length)await step.sendEvent("resume-syncs",pending.map(s=>({id:"shopify-recover-"+s.id+"-"+Math.floor(Date.now()/300000),name:"shopify/sync.requested",data:{storeId:s.id,installationId:s.installation_id}})));
 const renew=await step.run("expiring-tokens",async()=>{const {data,error}=await createAdminClient().from("shopify_stores").select("id,installation_id").eq("status","connected").lt("access_expires_at",new Date(Date.now()+300000).toISOString()).order("access_expires_at").limit(25);if(error)throw new Error("SHOPIFY_REFRESH_READ_FAILED");return data??[];});
 for(const s of renew)await step.run("refresh-"+s.id,async()=>{try{await storeToken(s.id,s.installation_id);return true;}catch(e){if(e instanceof Error&&e.message==="CATALOG_UPGRADE_REQUIRED")return false;if(e instanceof Error&&e.message==="SHOPIFY_RECONNECT_REQUIRED"){const {error}=await createAdminClient().from("shopify_stores").update({status:"reconnect",error_code:"SHOPIFY_RECONNECT_REQUIRED"}).eq("id",s.id).eq("installation_id",s.installation_id).eq("status","connected");if(error)throw new Error("SHOPIFY_STATE_SAVE_FAILED");return false;}throw e;}});
 return {queued:pending.length};
});
