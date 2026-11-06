import {cookies} from "next/headers";
import {after} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {catalogOwner} from "@/lib/catalog/auth";
import {encryptCatalogSecret} from "@/lib/catalog/security";
import {callbackValid,shopDomain,stateHash,shopifyConfigured,SHOPIFY_COOKIE} from "@/lib/shopify/security";
import {tokenRequest,graph} from "@/lib/shopify/api";
import {inngest} from "@/inngest/client";
export const maxDuration=60;
export async function GET(request:Request){
 const finish=(notice:string)=>Response.redirect("https://gooidy.com/dashboard/stores?notice="+notice,303);
 if(!shopifyConfigured())return finish("unavailable");
 try{
  const params=new URL(request.url).searchParams,jar=await cookies(),state=params.get("state")??"";
  if(!/^[a-f0-9]{64}$/.test(state)||jar.get(SHOPIFY_COOKIE)?.value!==state||!callbackValid(params,process.env.SHOPIFY_CLIENT_SECRET!))return finish("connect_error");
  jar.delete(SHOPIFY_COOKIE);
  const shop=shopDomain(params.get("shop"));const db=createAdminClient();const {data:{user},error:authError}=await (await createClient()).auth.getUser();if(authError||!user)return finish("connect_error");
  const {data:pending,error:read}=await db.from("shopify_oauth_states").select("*").eq("state_hash",stateHash(state)).eq("user_id",user.id).eq("shop",shop).gt("expires_at",new Date().toISOString()).single();if(read||!pending)return finish("connect_error");
  await catalogOwner(pending.workspace_id);
  const {data:claimed,error:claim}=await db.from("shopify_oauth_states").delete().eq("state_hash",stateHash(state)).eq("user_id",user.id).select("state_hash").maybeSingle();if(claim||!claimed)return finish("connect_error");
  if(params.has("error"))return finish("canceled");
  const code=params.get("code");if(!code||code.length>2048)return finish("connect_error");
  const token=await tokenRequest(shop,{code,expiring:"1"});
  const details=await graph<{shop:{id:string;name:string;myshopifyDomain:string;primaryDomain:{url:string}}}>(shop,token.access_token,"{shop{id name myshopifyDomain primaryDomain{url}}}");
  if(shopDomain(details.shop.myshopifyDomain)!==shop)return finish("connect_error");
  const origin=new URL(details.shop.primaryDomain.url);if(origin.protocol!=="https:"||origin.username||origin.password)throw new Error("SHOPIFY_STORE_INVALID");
  const {data:store,error:save}=await db.rpc("install_shopify_store",{ws:pending.workspace_id,domain:shop,store_origin:origin.origin,store_name:details.shop.name,provider_shop_id:details.shop.id,credentials:encryptCatalogSecret(JSON.stringify(token)),webhook_key:encryptCatalogSecret(process.env.SHOPIFY_CLIENT_SECRET!),access_expiry:new Date(Date.now()+token.expires_in*1000).toISOString(),refresh_expiry:new Date(Date.now()+token.refresh_token_expires_in*1000).toISOString()});if(save||!store)throw new Error("SHOPIFY_INSTALL_FAILED");
  after(async()=>{try{await inngest.send({name:"shopify/sync.requested",data:{storeId:store.id,installationId:store.installation_id}});}catch{console.error("Shopify sync deferred",store.id);}});
  return finish("connected");
 }catch{return finish("connect_error");}
}
