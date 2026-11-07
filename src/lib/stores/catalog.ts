import "server-only";
import {createAdminClient} from "@/lib/supabase/admin";
import {encryptCatalogSecret,decryptCatalogSecret} from "@/lib/catalog/security";
import {requireStorePlan} from "@/lib/catalog/access";
import {canonicalProduct,type CatalogConnection} from "@/lib/catalog/normalize";
import {parsePublicHttpUrl} from "@/lib/public-fetch";
import {storeProvider,providerReady,type StoreProvider} from "./providers";
import {fixedJson,wooJson,wixToken,squarespaceToken,obj,str,type Credentials,type ObjectData} from "./api";
const records=(v:unknown)=>{if(!Array.isArray(v))throw new Error("STORE_RESPONSE_INVALID");return v.map(obj);};
function photos(provider:StoreProvider,p:ObjectData){
 let values:unknown[]=[];
 if(provider==="woocommerce"||provider==="squarespace")values=Array.isArray(p.images)?p.images.map(x=>obj(x).src??obj(x).url):[];
 else if(provider==="bigcommerce")values=Array.isArray(p.images)?p.images.map(x=>obj(x).url_zoom??obj(x).url_standard):[];
 else{const media:ObjectData=p.media?obj(p.media):{},items:unknown[]=[...(Array.isArray(media.items)?media.items:[]),...(media.mainMedia?[media.mainMedia]:[])];values=items.flatMap(x=>{const item=obj(x);return item.image?[obj(item.image).url]:[];});}
 return [...new Set(values.flatMap(v=>{try{const u=parsePublicHttpUrl(str(v));if(u.protocol!=="https:")return [];if(provider==="wix"&&u.hostname==="static.wixstatic.com")u.pathname=u.pathname.split("/v1/")[0];return [u.toString()];}catch{return [];}}))].slice(0,30);
}
export function nativeProduct(provider:StoreProvider,p:ObjectData,c:CatalogConnection,observed:string,storeUrl:string){
 let url:unknown=p.permalink??p.url,quantity:number|null=null,updated:unknown=p.modifiedOn;
 const name=p.name,id=p.id;
 if(provider==="woocommerce"){updated=typeof p.date_modified_gmt==="string"?p.date_modified_gmt+"Z":observed;if(p.stock_status==="outofstock")quantity=0;else if(p.manage_stock&&Number.isSafeInteger(p.stock_quantity))quantity=Math.max(0,Number(p.stock_quantity));}
 if(provider==="bigcommerce"){url=new URL(str(obj(p.custom_url).url),storeUrl+"/").toString();updated=p.date_modified;if(p.is_visible===false)quantity=0;else if(p.inventory_tracking==="product"&&Number.isSafeInteger(p.inventory_level))quantity=Math.max(0,Number(p.inventory_level));}
 if(provider==="wix"){const page=obj(p.productPageUrl);url=str(page.base).replace(/\/$/,"")+"/"+str(page.path).replace(/^\//,"");updated=p.lastUpdated;const stock:ObjectData=p.stock?obj(p.stock):{};if(p.visible===false||stock.inStock===false)quantity=0;}
 if(provider==="squarespace"&&p.isVisible===false)quantity=0;
 const images=photos(provider,p);if(!images.length)return null;
 const timestamp=typeof updated==="string"&&/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(updated)?updated:observed;
 return canonicalProduct({externalId:id,name,url:new URL(str(url),storeUrl+"/").toString(),images,inventoryQuantity:quantity,inventoryUpdatedAt:observed,updatedAt:timestamp},c);
}
export async function platformCredentials(id:string,installation:string){
 const db=createAdminClient();const {data:store,error}=await db.from("platform_stores").select("*").eq("id",id).eq("installation_id",installation).single();if(error||!store?.credentials_cipher||["disconnected","reconnect"].includes(store.status))throw new Error("STORE_RECONNECT_REQUIRED");
 await requireStorePlan(store.workspace_id);const provider=storeProvider(store.provider);if(!providerReady(provider))throw new Error("STORE_PLATFORM_UNAVAILABLE");
 let credentials=JSON.parse(decryptCatalogSecret(store.credentials_cipher)) as Credentials;
 if(!credentials.accessExpiresAt||credentials.accessExpiresAt>Date.now()+120000)return {store,credentials};
 const lock=new Date(Date.now()+60000).toISOString();
 const {data:claimed,error:claim}=await db.from("platform_stores").update({refresh_lock:lock}).eq("id",id).eq("installation_id",installation).eq("credentials_cipher",store.credentials_cipher).or("refresh_lock.is.null,refresh_lock.lt."+new Date().toISOString()).select("id").maybeSingle();if(claim||!claimed)throw new Error("STORE_REFRESH_BUSY");
 try{
  if(provider==="wix")credentials=await wixToken(str(credentials.instanceId));
  else if(provider==="squarespace"&&credentials.refreshExpiresAt&&credentials.refreshExpiresAt>Date.now())credentials=await squarespaceToken({grant_type:"refresh_token",refresh_token:str(credentials.refreshToken)});
  else throw new Error("STORE_RECONNECT_REQUIRED");
  const {data:saved,error:save}=await db.from("platform_stores").update({credentials_cipher:encryptCatalogSecret(JSON.stringify(credentials)),refresh_lock:null}).eq("id",id).eq("installation_id",installation).eq("refresh_lock",lock).neq("status","disconnected").select("id").maybeSingle();if(save||!saved)throw new Error("STORE_CREDENTIAL_SAVE_FAILED");
  return {store,credentials};
 }catch(e){const {error:unlock}=await db.from("platform_stores").update({refresh_lock:null}).eq("id",id).eq("installation_id",installation).eq("refresh_lock",lock);if(unlock)throw new Error("STORE_CREDENTIAL_SAVE_FAILED");throw e;}
}
export async function nativeCatalogPage(store:ObjectData,credentials:Credentials){
 const provider=storeProvider(store.provider),cursor=String(store.cursor??""),storeUrl=str(store.store_url);
 if(provider==="woocommerce"){
  const page=cursor?Number(cursor):1;if(!Number.isInteger(page)||page<1||page>10000)throw new Error("STORE_CURSOR_INVALID");
  const products=records(await wooJson(storeUrl,credentials,"/wp-json/wc/v3/products?status=publish&per_page=50&page="+page));
  return {products,cursor:products.length===50?String(page+1):null};
 }
 if(provider==="bigcommerce"){
  const context=str(credentials.context);if(!/^stores\/[a-z0-9]{2,64}$/.test(context))throw new Error("STORE_CONTEXT_INVALID");
  const page=cursor?Number(cursor):1;if(!Number.isInteger(page)||page<1||page>10000)throw new Error("STORE_CURSOR_INVALID");
  const data=await fixedJson("https://api.bigcommerce.com/"+context+"/v3/catalog/products?include=images&limit=50&page="+page,{headers:{"X-Auth-Token":str(credentials.accessToken)}});
  const products=records(data.data),pagination=obj(obj(data.meta).pagination);return {products,cursor:Number(pagination.current_page)<Number(pagination.total_pages)?String(page+1):null};
 }
 if(provider==="squarespace"){
  const data=await fixedJson("https://api.squarespace.com/1.0/commerce/products"+(cursor?"?cursor="+encodeURIComponent(cursor):""),{headers:{Authorization:"Bearer "+str(credentials.accessToken)}});
  const pagination=obj(data.pagination);return {products:records(data.products),cursor:pagination.hasNextPage?str(pagination.nextPageCursor):null};
 }
 const offset=cursor?Number(cursor):0;if(!Number.isInteger(offset)||offset<0||offset>100000)throw new Error("STORE_CURSOR_INVALID");
 const data=await fixedJson("https://www.wixapis.com/stores/v1/products/query",{method:"POST",headers:{Authorization:str(credentials.accessToken)},body:JSON.stringify({query:{paging:{limit:50,offset}}})});
 const products=records(data.products);return {products,cursor:products.length===50?String(offset+50):null};
}
