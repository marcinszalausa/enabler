import {inngest} from "./client";
import {createAdminClient} from "@/lib/supabase/admin";
import {decryptCatalogSecret} from "@/lib/catalog/security";
import {pausePaidAd} from "@/lib/catalog/paid-ad-pause";
export async function confirmStockPause(id:string){
 const db=createAdminClient();const {data:pause,error}=await db.from("catalog_stock_pauses").select("*,catalog_ad_bindings!inner(*,catalog_ad_accounts!inner(*))").eq("id",id).single();
 if(error||!pause)throw new Error("STOCK_PAUSE_MISSING");if(pause.status==="confirmed")return;
 const binding=pause.catalog_ad_bindings,account=binding.catalog_ad_accounts;
 try{
  if(!account.enabled)throw new Error("PAID_ACCOUNT_RECONNECT_REQUIRED");
  const token=decryptCatalogSecret(account.credentials_cipher);
  await pausePaidAd({provider:account.provider,accountId:account.external_account_id,adId:binding.external_ad_id,token});
  const {error:save}=await db.from("catalog_ad_bindings").update({status:"paused"}).eq("id",binding.id).eq("workspace_id",account.workspace_id);if(save)throw new Error("STOCK_PAUSE_SAVE_FAILED");
  const {error:done}=await db.from("catalog_stock_pauses").update({status:"confirmed",confirmed_at:new Date().toISOString(),error_code:null}).eq("id",id);if(done)throw new Error("STOCK_PAUSE_SAVE_FAILED");
 }catch(e){const code=e instanceof Error&&/^[A-Z_]+$/.test(e.message)?e.message:"PAID_AD_PAUSE_FAILED";const {error:save}=await db.from("catalog_stock_pauses").update({error_code:code}).eq("id",id);if(save)throw new Error("STOCK_PAUSE_SAVE_FAILED");throw new Error(code);}
}
export const pauseStockAds=inngest.createFunction({id:"catalog-pause-out-of-stock-ads",triggers:{event:"catalog/stock.pause"},retries:5,concurrency:{limit:3}},async({event,step})=>{
 const id=String(event.data.pauseId??"");if(!/^[a-f0-9-]{36}$/.test(id))throw new Error("STOCK_PAUSE_INVALID");await step.run("pause-and-confirm",()=>confirmStockPause(id));return {confirmed:true};
});
export const recoverStockPauses=inngest.createFunction({id:"catalog-stock-pause-recovery",triggers:{cron:"* * * * *"},retries:3,concurrency:{limit:1}},async({step})=>{
 const pending=await step.run("pending-pauses",async()=>{const {data,error}=await createAdminClient().from("catalog_stock_pauses").select("id").eq("status","pending").order("requested_at").limit(100);if(error)throw new Error("STOCK_PAUSE_RECOVERY_FAILED");return data??[];});
 if(pending.length)await step.sendEvent("recover",pending.map(p=>({id:"stock-pause-"+p.id+"-"+Math.floor(Date.now()/60000),name:"catalog/stock.pause",data:{pauseId:p.id}})));
 return {pending:pending.length};
});
