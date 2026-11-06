import "server-only";
import {createAdminClient} from "@/lib/supabase/admin";
import {encryptCatalogSecret,decryptCatalogSecret} from "@/lib/catalog/security";
import {SHOPIFY_API_VERSION,shopDomain,hasScopes} from "./security";
export type ShopifyToken={access_token:string;refresh_token:string;expires_in:number;refresh_token_expires_in:number;scope:string};
export async function tokenRequest(shop:string,grant:Record<string,string>):Promise<ShopifyToken>{
 const response=await fetch("https://"+shopDomain(shop)+"/admin/oauth/access_token",{method:"POST",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15000),headers:{"Content-Type":"application/json"},body:JSON.stringify({client_id:process.env.SHOPIFY_CLIENT_ID,client_secret:process.env.SHOPIFY_CLIENT_SECRET,...grant})});
 if(!response.ok)throw new Error("SHOPIFY_RECONNECT_REQUIRED");
 const token=await response.json() as ShopifyToken;
 if(typeof token.access_token!=="string"||typeof token.refresh_token!=="string"||!Number.isSafeInteger(token.expires_in)||token.expires_in<1||!Number.isSafeInteger(token.refresh_token_expires_in)||token.refresh_token_expires_in<1||typeof token.scope!=="string"||!hasScopes(token.scope))throw new Error("SHOPIFY_TOKEN_INVALID");
 return token;
}
export async function graph<T>(shop:string,token:string,query:string,variables:Record<string,unknown>={}):Promise<T>{
 const response=await fetch("https://"+shopDomain(shop)+"/admin/api/"+SHOPIFY_API_VERSION+"/graphql.json",{method:"POST",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(20000),headers:{"Content-Type":"application/json","X-Shopify-Access-Token":token},body:JSON.stringify({query,variables})});
 if(response.status===401||response.status===403)throw new Error("SHOPIFY_RECONNECT_REQUIRED");
 if(!response.ok)throw new Error("SHOPIFY_REQUEST_FAILED");
 const result=await response.json();if(result.errors?.length||!result.data)throw new Error("SHOPIFY_REQUEST_FAILED");return result.data as T;
}
export async function storeToken(id:string,installation:string){
 const db=createAdminClient();const {data:store,error}=await db.from("shopify_stores").select("*").eq("id",id).eq("installation_id",installation).single();
 if(error||!store?.credentials_cipher||["disconnected","reconnect"].includes(store.status))throw new Error("SHOPIFY_RECONNECT_REQUIRED");
 const token=JSON.parse(decryptCatalogSecret(store.credentials_cipher)) as ShopifyToken;
 if(Date.parse(store.access_expires_at)>Date.now()+120000)return {store,token:token.access_token};
 if(Date.parse(store.refresh_expires_at)<=Date.now())throw new Error("SHOPIFY_RECONNECT_REQUIRED");
 const lock=new Date(Date.now()+60000).toISOString();
 const {data:claimed,error:claimError}=await db.from("shopify_stores").update({refresh_lock:lock}).eq("id",id).eq("installation_id",installation).eq("credentials_cipher",store.credentials_cipher).or("refresh_lock.is.null,refresh_lock.lt."+new Date().toISOString()).select("id").maybeSingle();
 if(claimError||!claimed)throw new Error("SHOPIFY_REFRESH_BUSY");
 try{
  const refreshed=await tokenRequest(store.shop,{grant_type:"refresh_token",refresh_token:token.refresh_token});
  const {data:saved,error:saveError}=await db.from("shopify_stores").update({credentials_cipher:encryptCatalogSecret(JSON.stringify(refreshed)),access_expires_at:new Date(Date.now()+refreshed.expires_in*1000).toISOString(),refresh_expires_at:new Date(Date.now()+refreshed.refresh_token_expires_in*1000).toISOString(),refresh_lock:null}).eq("id",id).eq("installation_id",installation).eq("refresh_lock",lock).neq("status","disconnected").select("id").maybeSingle();
  if(saveError||!saved)throw new Error("SHOPIFY_TOKEN_SAVE_FAILED");return {store,token:refreshed.access_token};
 }catch(e){
  const code=e instanceof Error?e.message:"SHOPIFY_REFRESH_FAILED";
  // Ambiguous refresh responses keep the prior encrypted token for provider-supported recovery.
  const {error:unlockError}=await db.from("shopify_stores").update({refresh_lock:null,...(code==="SHOPIFY_RECONNECT_REQUIRED"?{status:"reconnect",error_code:code}:{})}).eq("id",id).eq("installation_id",installation).eq("refresh_lock",lock);
  if(unlockError)throw new Error("SHOPIFY_TOKEN_SAVE_FAILED");throw e;
 }
}
