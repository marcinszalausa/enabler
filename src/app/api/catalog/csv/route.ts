import {after} from "next/server";
import {createHash,randomBytes} from "node:crypto";
import {createAdminClient} from "@/lib/supabase/admin";
import {catalogStoreOwner} from "@/lib/catalog/auth";
import {catalogBody,catalogEnabled,encryptCatalogSecret} from "@/lib/catalog/security";
import {parsePublicHttpUrl} from "@/lib/public-fetch";
import {catalogCsv,type CatalogConnection} from "@/lib/catalog/normalize";
import {receiveCatalog} from "@/lib/catalog/store";
import {inngest} from "@/inngest/client";
export async function POST(request:Request){
 const headers={"Cache-Control":"private, no-store"};
 if(request.headers.get("origin")!==new URL(request.url).origin)return Response.json({code:"ACCESS_DENIED"},{status:403,headers});
 if(!catalogEnabled())return Response.json({code:"CATALOG_NOT_CONFIGURED"},{status:503,headers});
 try{
  const input=JSON.parse((await catalogBody(request,1200000)).toString());await catalogStoreOwner(input.workspaceId);
  if(input.rightsConfirmed!==true||typeof input.csv!=="string")throw new Error("CATALOG_IMPORT_INVALID");
  const url=parsePublicHttpUrl(String(input.storeUrl));if(url.protocol!=="https:"||url.pathname!=="/"||url.search||url.hash)throw new Error("CATALOG_STORE_INVALID");
  const source:CatalogConnection={id:"",workspace_id:input.workspaceId,platform:"custom",store_origin:url.origin,webhook_domain:url.hostname,enabled:true};const products=catalogCsv(input.csv,source);
  const db=createAdminClient();const {data:connectionId,error}=await db.rpc("ensure_csv_catalog_connection",{ws:input.workspaceId,origin:url.origin,encrypted_key:encryptCatalogSecret(randomBytes(32).toString("hex"))});if(error||!connectionId)throw new Error("CATALOG_CONNECTION_WRITE_FAILED");source.id=connectionId;
  const id=await receiveCatalog(source,"csv:"+createHash("sha256").update(input.csv).digest("hex"),Buffer.from(input.csv),products);
  after(async()=>{try{await inngest.send({id:"catalog-delivery-"+id,name:"catalog/delivery.received",data:{deliveryId:id}});}catch{console.error("CSV delivery deferred",id);}});
  return Response.json({received:true,products:products.length},{status:202,headers});
 }catch(e){const code=e instanceof Error&&/^CATALOG_[A-Z_]+$/.test(e.message)?e.message:"CATALOG_IMPORT_INVALID";return Response.json({code},{status:/OWNER|UPGRADE|SIGN_IN/.test(code)?403:/WRITE_FAILED/.test(code)?503:400,headers});}
}
