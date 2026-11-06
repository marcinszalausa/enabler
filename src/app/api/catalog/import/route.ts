import {after} from "next/server";
import {catalogOwner,catalogSameOrigin} from "@/lib/catalog/auth";
import {catalogBody,catalogEnabled} from "@/lib/catalog/security";
import {catalogCsv} from "@/lib/catalog/normalize";
import {loadConnection,receiveCatalog} from "@/lib/catalog/store";
import {inngest} from "@/inngest/client";
export async function POST(request:Request){
 if(!catalogEnabled())return Response.json({code:"CATALOG_NOT_CONFIGURED"},{status:503});
 try{
  catalogSameOrigin(request);const input=JSON.parse((await catalogBody(request,1200000)).toString("utf8"));
  if(typeof input.connectionId!=="string"||typeof input.csv!=="string")throw new Error("CATALOG_IMPORT_INVALID");
  await catalogOwner(input.workspaceId);const c=await loadConnection(input.connectionId);if(c.workspace_id!==input.workspaceId)throw new Error("CATALOG_OWNER_REQUIRED");const key=request.headers.get("idempotency-key")??"";if(!/^[A-Za-z0-9._:-]{1,128}$/.test(key))throw new Error("CATALOG_IDEMPOTENCY_KEY_REQUIRED");const products=catalogCsv(input.csv,c);
  const body=Buffer.from(input.csv);const id=await receiveCatalog(c,"import:"+key,body,products);
  after(async()=>{if(process.env.INNGEST_EVENT_KEY)try{await inngest.send({id:"catalog-delivery-"+id,name:"catalog/delivery.received",data:{deliveryId:id}});}catch{console.error("Catalog import dispatch deferred",id);}});
  return Response.json({received:true,id,products:products.length});
 }catch(e){const code=e instanceof Error?e.message:"CATALOG_ERROR";return Response.json({code:/^CATALOG_[A-Z_]+$/.test(code)?code:"CATALOG_INVALID_REQUEST"},{status:code.includes("SIGN_IN")?401:code.includes("OWNER")||code.includes("ORIGIN")?403:code==="CATALOG_EVENT_CONFLICT"?409:code.includes("WRITE_FAILED")?503:400});}
}
