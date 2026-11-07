import {inngest} from "./client";
import {createAdminClient} from "@/lib/supabase/admin";
import {storeToken,graph} from "@/lib/shopify/api";
import {loadConnection} from "@/lib/catalog/store";
import {shopifyQuantity} from "@/lib/catalog/inventory-policy";
type Product={id:string;status:string;tracksInventory:boolean;totalInventory:number};
export async function reconcileShopifyInventory(signalId:string){
 const db=createAdminClient();const {data:signal,error}=await db.from("catalog_inventory_signals").select("*").eq("id",signalId).single();
 if(error||!signal)throw new Error("INVENTORY_SIGNAL_MISSING");if(signal.status==="processed")return;
 const auth=await storeToken(signal.store_id,signal.installation_id),c=await loadConnection(auth.store.connection_id);
 const observed=new Date().toISOString();
 const data=await graph<{inventoryItem:{variant:{product:Product}|null}|null}>(auth.store.shop,auth.token,"query Stock($id:ID!){inventoryItem(id:$id){variant{product{id status tracksInventory totalInventory}}}}",{id:signal.inventory_item_id});
 const p=data.inventoryItem?.variant?.product;
 if(p){const {error:save}=await db.rpc("apply_catalog_inventory",{connection:c.id,external:p.id.split("/").pop(),quantity:shopifyQuantity(p),observed});if(save)throw new Error("INVENTORY_WRITE_FAILED");}
 const {error:done}=await db.from("catalog_inventory_signals").update({status:"processed",processed_at:new Date().toISOString()}).eq("id",signalId);if(done)throw new Error("INVENTORY_SIGNAL_SAVE_FAILED");
}
export const syncInventory=inngest.createFunction({id:"shopify-reconcile-inventory",triggers:{event:"catalog/inventory.changed"},retries:5,concurrency:{limit:3}},async({event,step})=>{
 const id=String(event.data.signalId??"");if(!/^[a-f0-9-]{36}$/.test(id))throw new Error("INVENTORY_SIGNAL_INVALID");
 await step.run("read-current-product-stock",()=>reconcileShopifyInventory(id));return {reconciled:true};
});
export const recoverInventory=inngest.createFunction({id:"catalog-inventory-recovery",triggers:{cron:"* * * * *"},retries:3,concurrency:{limit:1}},async({step})=>{
 const pending=await step.run("pending-signals",async()=>{const {data,error}=await createAdminClient().from("catalog_inventory_signals").select("id").eq("status","pending").order("created_at").limit(50);if(error)throw new Error("INVENTORY_RECOVERY_FAILED");return data??[];});
 if(pending.length)await step.sendEvent("recover-signals",pending.map(s=>({id:"inventory-recovery-"+s.id+"-"+Math.floor(Date.now()/60000),name:"catalog/inventory.changed",data:{signalId:s.id}})));
 return {pending:pending.length};
});
