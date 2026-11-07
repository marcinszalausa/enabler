import {inngest} from "./client";
import {createAdminClient} from "@/lib/supabase/admin";
import {storeToken,graph} from "@/lib/shopify/api";
import {loadConnection} from "@/lib/catalog/store";
import {shopifyQuantity} from "@/lib/catalog/inventory-policy";
import {dispatchStockPauses} from "@/lib/catalog/stock-dispatch";
type Variants={nodes:{inventoryItem:{tracked:boolean}}[];pageInfo:{hasNextPage:boolean;endCursor:string|null}};
type Product={id:string;status:string;tracksInventory:boolean;totalInventory:number;variants:Variants};
export async function reconcileShopifyInventory(signalId:string){
 const db=createAdminClient();const {data:signal,error}=await db.from("catalog_inventory_signals").select("*,shopify_stores!inner(installation_id,status)").eq("id",signalId).single();
 if(error||!signal)throw new Error("INVENTORY_SIGNAL_MISSING");if(signal.status==="processed")return;
 if(signal.shopify_stores.installation_id!==signal.installation_id||signal.shopify_stores.status==="disconnected"){
  const {error}=await db.from("catalog_inventory_signals").update({status:"processed",processed_at:new Date().toISOString()}).eq("id",signalId);if(error)throw new Error("INVENTORY_SIGNAL_SAVE_FAILED");return;
 }
 const auth=await storeToken(signal.store_id,signal.installation_id),c=await loadConnection(auth.store.connection_id);
 const observed=new Date().toISOString();
 const fields="id status tracksInventory totalInventory variants(first:100){nodes{inventoryItem{tracked}}pageInfo{hasNextPage endCursor}}";
 const query=signal.resource_id.startsWith("gid://shopify/Product/")?"query Stock($id:ID!){product(id:$id){"+fields+"}}":"query Stock($id:ID!){inventoryItem(id:$id){variant{product{"+fields+"}}}}";
 const data=await graph<{inventoryItem?:{variant:{product:Product}|null}|null;product?:Product|null}>(auth.store.shop,auth.token,query,{id:signal.resource_id});
 const p=data.product??data.inventoryItem?.variant?.product;
 if(p){let variants=p.variants,all=!!variants&&variants.nodes.length>0&&variants.nodes.every(v=>v.inventoryItem.tracked),pages=0;
  while(all&&variants.pageInfo.hasNextPage&&pages++<25){const next=await graph<{product:{variants:Variants}}>(auth.store.shop,auth.token,"query Variants($id:ID!,$after:String!){product(id:$id){variants(first:100,after:$after){nodes{inventoryItem{tracked}}pageInfo{hasNextPage endCursor}}}}",{id:p.id,after:variants.pageInfo.endCursor});if(next.product.variants.pageInfo.endCursor===variants.pageInfo.endCursor)throw new Error("INVENTORY_CURSOR_INVALID");variants=next.product.variants;all=all&&variants.nodes.every(v=>v.inventoryItem.tracked);}
  const {error:save}=await db.rpc("apply_catalog_inventory",{connection:c.id,external:p.id.split("/").pop(),quantity:shopifyQuantity({...p,allVariantsTracked:all&&!variants.pageInfo.hasNextPage}),observed});if(save)throw new Error("INVENTORY_WRITE_FAILED");}
 const {error:done}=await db.from("catalog_inventory_signals").update({status:"processed",processed_at:new Date().toISOString()}).eq("id",signalId);if(done)throw new Error("INVENTORY_SIGNAL_SAVE_FAILED");
 await dispatchStockPauses(c.id);
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
