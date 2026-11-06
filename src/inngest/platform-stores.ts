import {inngest} from "./client";
import {createAdminClient} from "@/lib/supabase/admin";
import {canConnectStores} from "@/lib/catalog/access";
import {loadConnection,receiveCatalog} from "@/lib/catalog/store";
import {platformCredentials,nativeCatalogPage,nativeProduct} from "@/lib/stores/catalog";
import {storeProvider,providerReady} from "@/lib/stores/providers";
import {createHash} from "node:crypto";
export async function syncPlatformPage(id:string,run:string){
 const db=createAdminClient();const {data:source,error}=await db.from("platform_stores").select("*").eq("id",id).eq("run_id",run).single();if(error||!source)throw new Error("STORE_INSTALL_CHANGED");
 if(source.status!=="syncing")return {done:true};
 const {store,credentials}=await platformCredentials(id,source.installation_id),connection=await loadConnection(store.connection_id),provider=storeProvider(store.provider),page=await nativeCatalogPage(store,credentials);
 const products=page.products.flatMap(p=>{try{const product=nativeProduct(provider,p,connection,source.sync_started_at,store.store_url);return product?[product]:[];}catch{return [];}});
 if(products.length){
  const body=Buffer.from(JSON.stringify(products)),hash=createHash("sha256").update(body).digest("hex");
  const receipt=await receiveCatalog(connection,"platform:"+run+":"+hash,body,products);
  const {error:apply}=await db.rpc("apply_catalog_delivery",{delivery:receipt});if(apply)throw new Error("STORE_IMPORT_FAILED");
 }
 if(page.cursor!==null&&page.cursor===store.cursor)throw new Error("STORE_CURSOR_INVALID");
 const {error:save}=await db.from("platform_stores").update({cursor:page.cursor??"",status:page.cursor===null?"connected":"syncing",synced_at:page.cursor===null?new Date().toISOString():null,error_code:null}).eq("id",id).eq("run_id",run).eq("status","syncing");if(save)throw new Error("STORE_IMPORT_SAVE_FAILED");
 return {done:page.cursor===null};
}
export const syncPlatformStore=inngest.createFunction({id:"native-store-catalog",triggers:{event:"store/catalog.requested"},retries:3,concurrency:[{limit:4},{limit:1,key:"event.data.storeId"}],onFailure:async({event})=>{
 const data=event.data.event.data;const {error}=await createAdminClient().from("platform_stores").update({status:"error",error_code:"STORE_IMPORT_INTERRUPTED"}).eq("id",String(data.storeId)).eq("run_id",String(data.runId)).eq("status","syncing");if(error)throw new Error("STORE_STATE_SAVE_FAILED");
}},async({event,step})=>{
 const id=String(event.data.storeId??""),run=String(event.data.runId??"");if(!/^[a-f0-9-]{36}$/.test(id)||!/^[a-f0-9-]{36}$/.test(run))throw new Error("STORE_ID_INVALID");
 for(let i=0;i<20;i++){
  try{const result=await step.run("page-"+i,()=>syncPlatformPage(id,run));if(result.done)return result;}
  catch(e){const code=e instanceof Error?e.message:"STORE_IMPORT_FAILED";if(code==="CATALOG_UPGRADE_REQUIRED"||code==="STORE_PLATFORM_UNAVAILABLE")return {paused:true};
   if(code==="STORE_RECONNECT_REQUIRED"){await step.run("require-reconnect",async()=>{const {error}=await createAdminClient().from("platform_stores").update({status:"reconnect",error_code:code}).eq("id",id).eq("run_id",run).neq("status","disconnected");if(error)throw new Error("STORE_STATE_SAVE_FAILED");});return {reconnect:true};}throw e;
  }
  await step.sleep("wait-"+i,"2s");
 }return {resumable:true};
});
export const recoverPlatformStores=inngest.createFunction({id:"native-store-recovery",triggers:{cron:"*/5 * * * *"},retries:2,concurrency:{limit:1}},async({step})=>{
 const rows=await step.run("pending",async()=>{
  const db=createAdminClient();
  for(const table of ["store_connect_intents","store_install_receipts"]){const {error}=await db.from(table).delete().lt("expires_at",new Date().toISOString());if(error)throw new Error("STORE_STATE_CLEANUP_FAILED");}
  const {data,error}=await db.from("platform_stores").select("id,provider,workspace_id,run_id,status").in("status",["syncing","connected"]).or("status.eq.syncing,synced_at.lt."+new Date(Date.now()-3600000).toISOString()).order("sync_started_at").limit(25);if(error)throw new Error("STORE_RECOVERY_FAILED");
  const events=[];
  for(const store of data??[]){if(!providerReady(storeProvider(store.provider))||!await canConnectStores(store.workspace_id))continue;
   if(store.status==="connected"){const {data:next,error:refresh}=await db.rpc("manage_platform_store",{ws:store.workspace_id,store_id:store.id,operation:"refresh"});if(refresh||!next)throw new Error("STORE_RECOVERY_FAILED");events.push({id:next.id,run_id:next.run_id});}
   else events.push(store);
  }return events;
 });
 if(rows.length)await step.sendEvent("resume",rows.map(s=>({id:"native-store-"+s.run_id+"-"+Math.floor(Date.now()/300000),name:"store/catalog.requested",data:{storeId:s.id,runId:s.run_id}})));
 return {queued:rows.length};
});
