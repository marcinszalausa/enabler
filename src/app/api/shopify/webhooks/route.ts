import {after} from "next/server";
import {catalogBody} from "@/lib/catalog/security";
import {rawWebhookValid,shopDomain} from "@/lib/shopify/security";
import {createAdminClient} from "@/lib/supabase/admin";
import {loadConnection,receiveCatalog} from "@/lib/catalog/store";
import {catalogWebhook} from "@/lib/catalog/normalize";
import {inngest} from "@/inngest/client";
export async function POST(request:Request){
 const secret=process.env.SHOPIFY_CLIENT_SECRET;if(process.env.VERCEL_ENV!=="production"||!secret)return new Response(null,{status:503});
 try{
  const body=await catalogBody(request);if(!rawWebhookValid(body,request.headers.get("x-shopify-hmac-sha256")??"",secret))return new Response(null,{status:401});
  const shop=shopDomain(request.headers.get("x-shopify-shop-domain")),topic=request.headers.get("x-shopify-topic"),payload=JSON.parse(body.toString());
  const db=createAdminClient();const {data:store,error}=await db.from("shopify_stores").select("id,connection_id,installation_id,installed_at,provider_shop_id,status").eq("shop",shop).maybeSingle();if(error)throw new Error("READ");
  // These scopes collect no customer/order records.
  if(["customers/data_request","customers/redact"].includes(topic??""))return new Response(null,{status:200});
  if(!store)return new Response(null,{status:200});
  if(topic==="app/uninstalled"||topic==="shop/redact"){
   const payloadShop=topic==="shop/redact"?payload.shop_domain:payload.myshopify_domain;
   const payloadId=String(topic==="shop/redact"?payload.shop_id:payload.id);
   if(payloadShop!==shop||store.provider_shop_id!=="gid://shopify/Shop/"+payloadId)return new Response(null,{status:400});
   const triggered=request.headers.get("x-shopify-triggered-at");
   if(triggered&&Number.isFinite(Date.parse(triggered))&&Date.parse(triggered)<Date.parse(store.installed_at))return new Response(null,{status:200});
   const {error:disabled}=await db.rpc("disconnect_shopify_store",{store_id:store.id,install:store.installation_id});if(disabled)throw new Error("DISABLE");
   if(topic==="shop/redact"){
    const {data:jobs,error:read}=await db.from("catalog_training_jobs").select("dataset_path,provider_training_id,candidate_version,catalog_items!inner(connection_id)").eq("catalog_items.connection_id",store.connection_id);
    if(read)throw new Error("READ");
    // Do not acknowledge completed erasure while provider training artifacts still need operator cleanup.
    if(jobs?.some(j=>j.provider_training_id||j.candidate_version))throw new Error("PROVIDER_ERASURE_REQUIRED");
    const paths=(jobs??[]).map(j=>j.dataset_path).filter((p):p is string=>typeof p==="string");
    if(paths.length){const {error:erasure}=await db.storage.from("catalog-training").remove(paths);if(erasure)throw new Error("STORAGE_ERASURE_FAILED");}
    const {error:removed}=await db.from("catalog_connections").delete().eq("id",store.connection_id);if(removed)throw new Error("DELETE");
   }
   return new Response(null,{status:200});
  }
  if(!["products/create","products/update"].includes(topic??"")||store.status==="disconnected")return new Response(null,{status:200});
  const c=await loadConnection(store.connection_id),products=catalogWebhook(payload,c,topic!);
  if(payload.status&&payload.status!=="active")products.forEach(p=>p.inventoryQuantity=0);
  const id=await receiveCatalog(c,request.headers.get("x-shopify-webhook-id")??"",body,products);
  after(async()=>{try{await inngest.send({name:"catalog/delivery.received",data:{deliveryId:id}});}catch{console.error("Shopify delivery deferred",id);}});
  return new Response(null,{status:200});
 }catch{return new Response(null,{status:503});}
}
