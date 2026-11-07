import {canConnectStores} from "@/lib/catalog/access";
import {after} from "next/server";
import {catalogBody} from "@/lib/catalog/security";
import {rawWebhookValid,shopDomain} from "@/lib/shopify/security";
import {createAdminClient} from "@/lib/supabase/admin";
import {loadConnection,receiveCatalog} from "@/lib/catalog/store";
import {catalogWebhook} from "@/lib/catalog/normalize";
import {inngest} from "@/inngest/client";
import {INVENTORY_TOPICS,inventorySignalId} from "@/lib/catalog/inventory-policy";
import {dispatchStockPauses} from "@/lib/catalog/stock-dispatch";
export async function POST(request:Request){
 const secret=process.env.SHOPIFY_CLIENT_SECRET;if(process.env.VERCEL_ENV!=="production"||!secret)return new Response(null,{status:503});
 try{
  const body=await catalogBody(request);if(!rawWebhookValid(body,request.headers.get("x-shopify-hmac-sha256")??"",secret))return new Response(null,{status:401});
  const shop=shopDomain(request.headers.get("x-shopify-shop-domain")),topic=request.headers.get("x-shopify-topic"),payload=JSON.parse(body.toString());
  const db=createAdminClient();const {data:store,error}=await db.from("shopify_stores").select("id,workspace_id,connection_id,installation_id,installed_at,provider_shop_id,status").eq("shop",shop).maybeSingle();if(error)throw new Error("READ");
  // These scopes collect no customer/order records.
  if(["customers/data_request","customers/redact"].includes(topic??""))return new Response(null,{status:200});
  if(!store)return new Response(null,{status:200});
  if(topic==="app/uninstalled"||topic==="shop/redact"){
   const payloadShop=topic==="shop/redact"?payload.shop_domain:payload.myshopify_domain;
   const payloadId=String(topic==="shop/redact"?payload.shop_id:payload.id);
   if(payloadShop!==shop||store.provider_shop_id!=="gid://shopify/Shop/"+payloadId)return new Response(null,{status:400});
   const triggered=request.headers.get("x-shopify-triggered-at");
   if(triggered&&Number.isFinite(Date.parse(triggered))&&Date.parse(triggered)<Date.parse(store.installed_at))return new Response(null,{status:200});
   const {data:disconnected,error:disabled}=await db.rpc("disconnect_shopify_store",{store_id:store.id,install:store.installation_id});if(disabled)throw new Error("DISABLE");if(disconnected!==true)return new Response(null,{status:200});
   if(topic==="shop/redact"){
    const {data:jobs,error:read}=await db.from("catalog_training_jobs").select("dataset_path,provider_training_id,candidate_version,catalog_items!inner(connection_id)").eq("catalog_items.connection_id",store.connection_id);
    if(read)throw new Error("READ");
    // Do not acknowledge completed erasure while provider training artifacts still need operator cleanup.
    if(jobs?.some(j=>j.provider_training_id||j.candidate_version))throw new Error("PROVIDER_ERASURE_REQUIRED");
    const paths=(jobs??[]).map(j=>j.dataset_path).filter((p):p is string=>typeof p==="string");
    if(paths.length){const {error:erasure}=await db.storage.from("catalog-training").remove(paths);if(erasure)throw new Error("STORAGE_ERASURE_FAILED");}
    const {error:removed}=await db.from("catalog_connections").delete().eq("id",store.connection_id).eq("enabled",false);if(removed)throw new Error("DELETE");
   }
   return new Response(null,{status:200});
  }
  if(store.status==="disconnected")return new Response(null,{status:200});
  if(!await canConnectStores(store.workspace_id))return new Response(null,{status:200});
  if(INVENTORY_TOPICS.includes(topic??"")){
   const event=request.headers.get("x-shopify-webhook-id")??"";if(!/^[A-Za-z0-9._:-]{1,180}$/.test(event))return new Response(null,{status:400});
   const inventoryId=inventorySignalId(payload.inventory_item_id);
   const {error:save}=await db.from("catalog_inventory_signals").upsert({store_id:store.id,installation_id:store.installation_id,event_id:event,resource_id:inventoryId},{onConflict:"store_id,installation_id,event_id",ignoreDuplicates:true});if(save)throw new Error("INVENTORY_SIGNAL_WRITE_FAILED");
   const {data:signal,error:read}=await db.from("catalog_inventory_signals").select("id,resource_id").eq("store_id",store.id).eq("installation_id",store.installation_id).eq("event_id",event).single();if(read||signal.resource_id!==inventoryId)throw new Error("INVENTORY_SIGNAL_CONFLICT");
   after(async()=>{try{await inngest.send({id:"inventory-signal-"+signal.id,name:"catalog/inventory.changed",data:{signalId:signal.id}});}catch{console.error("Inventory reconciliation deferred",signal.id);}});
   return new Response(null,{status:200});
  }
  if(topic==="products/delete"){
   const {data:item,error:read}=await db.from("catalog_items").select("id").eq("connection_id",store.connection_id).eq("external_id",String(payload.id)).maybeSingle();if(read)throw new Error("CATALOG_READ_FAILED");
   if(item){const {error:save}=await db.rpc("apply_catalog_inventory",{connection:store.connection_id,external:String(payload.id),quantity:0,observed:request.headers.get("x-shopify-triggered-at")??new Date().toISOString()});if(save)throw new Error("CATALOG_DELETE_STOCK_FAILED");}
   return new Response(null,{status:200});
  }
  if(!["products/create","products/update"].includes(topic??""))return new Response(null,{status:200});
  const c=await loadConnection(store.connection_id),products=catalogWebhook(payload,c,topic!);
  const {data:prior,error:priorError}=await db.from("catalog_items").select("inventory_quantity,inventory_updated_at").eq("connection_id",c.id).eq("external_id",String(payload.id)).maybeSingle();if(priorError)throw new Error("CATALOG_READ_FAILED");
  // Payloads may truncate variants. Preserve known stock until GraphQL
  // confirms the aggregate; archived products are unavailable.
  products.forEach(p=>{p.inventoryQuantity=payload.status&&payload.status!=="active"?0:prior?.inventory_quantity??null;p.inventoryUpdatedAt=payload.status&&payload.status!=="active"?p.updatedAt:prior?.inventory_updated_at??p.updatedAt;});
  const id=await receiveCatalog(c,request.headers.get("x-shopify-webhook-id")??"",body,products);
  const {error:apply}=await db.rpc("apply_catalog_delivery",{delivery:id});if(apply)throw new Error("CATALOG_DELIVERY_APPLY_FAILED");
  const productGid="gid://shopify/Product/"+String(payload.id);if(!/^gid:\/\/shopify\/Product\/[0-9]+$/.test(productGid))return new Response(null,{status:400});
  const event="product:"+(request.headers.get("x-shopify-webhook-id")??"");const {error:stock}=await db.from("catalog_inventory_signals").upsert({store_id:store.id,installation_id:store.installation_id,event_id:event,resource_id:productGid},{onConflict:"store_id,installation_id,event_id",ignoreDuplicates:true});if(stock)throw new Error("INVENTORY_SIGNAL_WRITE_FAILED");
  after(async()=>{try{await dispatchStockPauses(c.id);await inngest.send({name:"catalog/delivery.received",data:{deliveryId:id}});}catch{console.error("Shopify delivery deferred",id);}});
  return new Response(null,{status:200});
 }catch(e){return new Response(null,{status:e instanceof Error&&e.message==="CATALOG_UPGRADE_REQUIRED"?200:503});}
}
