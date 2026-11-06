import {createAdminClient} from "@/lib/supabase/admin";
import {parsePublicHttpUrl} from "@/lib/public-fetch";
import {catalogOwner,catalogSameOrigin} from "@/lib/catalog/auth";
import {catalogBody,catalogEnabled,encryptCatalogSecret} from "@/lib/catalog/security";
export async function POST(request:Request){
 if(!catalogEnabled())return Response.json({code:"CATALOG_NOT_CONFIGURED"},{status:503});
 try{
  catalogSameOrigin(request);const input=JSON.parse((await catalogBody(request,16384)).toString("utf8"));await catalogOwner(input.workspaceId);
  if(!["shopify","woocommerce","wix","custom"].includes(input.platform)||typeof input.webhookSecret!=="string"||input.webhookSecret.length<16||input.webhookSecret.length>512)throw new Error("CATALOG_CONFIG_INVALID");
  const origin=parsePublicHttpUrl(String(input.storeUrl));if(origin.protocol!=="https:"||origin.pathname!=="/"||origin.search)throw new Error("CATALOG_STORE_INVALID");
  const domain=String(input.webhookDomain??origin.hostname).toLowerCase();if(!/^[a-z0-9.-]{3,253}$/.test(domain)||input.platform==="shopify"&&!/^[a-z0-9-]+\.myshopify\.com$/.test(domain))throw new Error("CATALOG_WEBHOOK_DOMAIN_INVALID");
  const db=createAdminClient();const {data,error}=await db.from("catalog_connections").insert({workspace_id:input.workspaceId,platform:input.platform,store_origin:origin.origin,webhook_domain:domain,enabled:false}).select("id").single();if(error||!data)throw new Error("CATALOG_CONNECTION_WRITE_FAILED");
  const {error:keyError}=await db.from("catalog_connection_keys").insert({connection_id:data.id,encrypted_secret:encryptCatalogSecret(input.webhookSecret)});if(keyError)throw new Error("CATALOG_SECRET_WRITE_FAILED");
  const {error:enableError}=await db.from("catalog_connections").update({enabled:true}).eq("id",data.id);if(enableError)throw new Error("CATALOG_CONNECTION_WRITE_FAILED");
  return Response.json({id:data.id,webhookPath:"/api/catalog/webhooks/"+data.id,adapter:input.platform==="wix"||input.platform==="custom"?"canonical_signed_bridge":"product_webhooks"},{status:201,headers:{"Cache-Control":"no-store"}});
 }catch(e){const code=e instanceof Error?e.message:"CATALOG_ERROR";return Response.json({code:/^CATALOG_[A-Z_]+$/.test(code)?code:"CATALOG_INVALID_REQUEST"},{status:code.includes("SIGN_IN")?401:code.includes("OWNER")||code.includes("ORIGIN")?403:code.includes("WRITE_FAILED")?503:400});}
}
