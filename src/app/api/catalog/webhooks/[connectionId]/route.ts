import {after} from "next/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {catalogWebhook} from "@/lib/catalog/normalize";
import {catalogBody,catalogEnabled,decryptCatalogSecret,verifyCatalogWebhook} from "@/lib/catalog/security";
import {loadConnection,receiveCatalog} from "@/lib/catalog/store";
import {inngest} from "@/inngest/client";
export const maxDuration=30;
export async function POST(request:Request,{params}:{params:Promise<{connectionId:string}>}){
 if(!catalogEnabled())return Response.json({code:"CATALOG_NOT_CONFIGURED"},{status:503});
 const {connectionId}=await params;if(!/^[a-f0-9-]{36}$/i.test(connectionId))return new Response(null,{status:404});
 try{
  const body=await catalogBody(request),c=await loadConnection(connectionId);
  const {data,error}=await createAdminClient().from("catalog_connection_keys").select("encrypted_secret").eq("connection_id",c.id).single();if(error||!data)throw new Error("CATALOG_SECRET_MISSING");
  if(!verifyCatalogWebhook(c,request.headers,body,decryptCatalogSecret(data.encrypted_secret)))return new Response(null,{status:401});
  const payload=JSON.parse(body.toString("utf8"));const topic=request.headers.get("x-shopify-topic")??request.headers.get("x-wc-webhook-topic")??"catalog.snapshot";
  const products=catalogWebhook(payload,c,topic);
  const eventId=request.headers.get("x-shopify-webhook-id")??request.headers.get("x-wc-webhook-delivery-id")??payload.event_id;
  const id=await receiveCatalog(c,String(eventId??""),body,products);
  after(async()=>{if(process.env.INNGEST_EVENT_KEY)try{await inngest.send({id:"catalog-delivery-"+id,name:"catalog/delivery.received",data:{deliveryId:id}});}catch{console.error("Catalog dispatch deferred to durable outbox",id);}});
  return Response.json({received:true,id});
 }catch(e){const code=e instanceof Error?e.message:"CATALOG_ERROR";return Response.json({code:/^CATALOG_[A-Z_]+$/.test(code)?code:"CATALOG_INVALID_REQUEST"},{status:code==="CATALOG_UPGRADE_REQUIRED"?200:code==="CATALOG_EVENT_CONFLICT"?409:code.includes("WRITE_FAILED")||code.includes("SECRET_MISSING")?503:400});}
}
