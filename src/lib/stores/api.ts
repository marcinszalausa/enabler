import "server-only";
import {fetchPublicUrl} from "@/lib/public-fetch";
import {storeAddress,verifyWixInstance,callbackUrl,intentHash,type StoreProvider} from "./providers";
export type Credentials={accessToken?:string;refreshToken?:string;accessExpiresAt?:number;refreshExpiresAt?:number;consumerKey?:string;consumerSecret?:string;instanceId?:string;context?:string};
export type StoreProof={provider:StoreProvider;providerId:string;storeUrl:string;name:string;credentials:Credentials};
export type ObjectData=Record<string,unknown>;
export const obj=(v:unknown):ObjectData=>{if(!v||typeof v!=="object"||Array.isArray(v))throw new Error("STORE_RESPONSE_INVALID");return v as ObjectData;};
export const str=(v:unknown)=>{if(typeof v!=="string"||!v||v.length>16384)throw new Error("STORE_RESPONSE_INVALID");return v;};
export async function fixedJson(url:string,options:RequestInit={}):Promise<ObjectData>{
 const response=await fetch(url,{...options,redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15000),headers:{"User-Agent":"Gooidy/1.0","Content-Type":"application/json",...options.headers}});
 if(response.status===401||response.status===403)throw new Error("STORE_RECONNECT_REQUIRED");
 if(!response.ok)throw new Error("STORE_PROVIDER_UNAVAILABLE");
 const reader=response.body?.getReader();if(!reader)throw new Error("STORE_RESPONSE_INVALID");
 const chunks:Uint8Array[]=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4000000){await reader.cancel();throw new Error("STORE_RESPONSE_TOO_LARGE");}chunks.push(value);}
 return obj(JSON.parse(Buffer.concat(chunks).toString()));
}
export async function wooJson(store:string,credentials:Credentials,path:string){
 const base=storeAddress(store);if(!path.startsWith("/wp-json/wc/v3/"))throw new Error("STORE_PATH_INVALID");
 const response=await fetchPublicUrl(base+path,{maxBytes:4000000,timeoutMs:15000,accept:"application/json",authorization:{origin:new URL(base).origin,value:"Basic "+Buffer.from(credentials.consumerKey+":"+credentials.consumerSecret).toString("base64")}});
 if(response.status===401||response.status===403)throw new Error("STORE_RECONNECT_REQUIRED");
 if(response.status!==200)throw new Error("STORE_PROVIDER_UNAVAILABLE");return JSON.parse(response.body.toString()) as unknown;
}
export async function squarespaceToken(values:Record<string,string>):Promise<Credentials>{
 const result=await fixedJson("https://login.squarespace.com/api/1/login/oauth/provider/tokens",{method:"POST",headers:{Authorization:"Basic "+Buffer.from(process.env.SQUARESPACE_CLIENT_ID+":"+process.env.SQUARESPACE_CLIENT_SECRET).toString("base64")},body:JSON.stringify(values)});
 const accessExpiresAt=Number(result.access_token_expires_at)*1000,refreshExpiresAt=Number(result.refresh_token_expires_at)*1000;
 if(!Number.isFinite(accessExpiresAt)||accessExpiresAt<=Date.now()||!Number.isFinite(refreshExpiresAt)||refreshExpiresAt<=Date.now())throw new Error("STORE_RESPONSE_INVALID");
 return {accessToken:str(result.access_token),refreshToken:str(result.refresh_token),accessExpiresAt,refreshExpiresAt};
}
export async function wixToken(instanceId:string):Promise<Credentials>{
 const result=await fixedJson("https://www.wixapis.com/oauth2/token",{method:"POST",body:JSON.stringify({grant_type:"client_credentials",client_id:process.env.WIX_CLIENT_ID,client_secret:process.env.WIX_CLIENT_SECRET,instance_id:instanceId})});
 const ttl=Number(result.expires_in);if(!Number.isSafeInteger(ttl)||ttl<=0)throw new Error("STORE_RESPONSE_INVALID");return {accessToken:str(result.access_token),accessExpiresAt:Date.now()+ttl*1000,instanceId};
}
export async function authorizeProof(provider:StoreProvider,params:URLSearchParams,body:ObjectData|null,expectedStore:string|null):Promise<StoreProof>{
 if(provider==="woocommerce"){
  if(!body||!expectedStore||body.key_permissions!=="read"||!/^ck_[a-f0-9]{40}$/.test(String(body.consumer_key))||!/^cs_[a-f0-9]{40}$/.test(String(body.consumer_secret)))throw new Error("STORE_PROOF_INVALID");
  const credentials={consumerKey:String(body.consumer_key),consumerSecret:String(body.consumer_secret)};
  const products=await wooJson(expectedStore,credentials,"/wp-json/wc/v3/products?per_page=1&status=publish&_fields=id");
  if(!Array.isArray(products))throw new Error("STORE_PROOF_INVALID");return {provider,providerId:storeAddress(expectedStore),storeUrl:storeAddress(expectedStore),name:new URL(expectedStore).hostname,credentials};
 }
 if(provider==="wix"){
  const instanceId=str(params.get("instanceId"));verifyWixInstance(str(params.get("signedInstance")),instanceId,process.env.WIX_CLIENT_SECRET!);
  if(params.get("appId")!==process.env.WIX_CLIENT_ID)throw new Error("STORE_PROOF_INVALID");
  const credentials=await wixToken(instanceId),info=await fixedJson("https://www.wixapis.com/apps/v1/instance",{headers:{Authorization:credentials.accessToken!}});
  const site=obj(info.site??obj(info.instance).site);
  return {provider,providerId:intentHash(instanceId),storeUrl:storeAddress(str(site.url)),name:typeof site.siteDisplayName==="string"?site.siteDisplayName:instanceId,credentials};
 }
 if(provider==="squarespace"){
  const credentials=await squarespaceToken({grant_type:"authorization_code",code:str(params.get("code")),redirect_uri:callbackUrl(provider)});
  const info=await fixedJson("https://api.squarespace.com/1.0/authorization/website",{headers:{Authorization:"Bearer "+credentials.accessToken}});
  return {provider,providerId:str(info.id??info.siteId),storeUrl:storeAddress(str(info.url)),name:typeof info.title==="string"?info.title:"Squarespace store",credentials};
 }
 const context=str(params.get("context"));if(!/^stores\/[a-z0-9]{2,64}$/.test(context))throw new Error("STORE_PROOF_INVALID");
 const scopes=str(params.get("scope")),required=["store_v2_information_read_only","store_v2_products_read_only"];
 if(!required.every(scope=>scopes.split(" ").includes(scope))||scopes.split(" ").some(scope=>!required.includes(scope)&&scope!=="store_v2_default"))throw new Error("STORE_SCOPE_INVALID");
 const result=await fixedJson("https://login.bigcommerce.com/oauth2/token",{method:"POST",body:JSON.stringify({client_id:process.env.BIGCOMMERCE_CLIENT_ID,client_secret:process.env.BIGCOMMERCE_CLIENT_SECRET,code:str(params.get("code")),context,scope:scopes,grant_type:"authorization_code",redirect_uri:callbackUrl(provider)})});
 if(result.context!==context||typeof result.scope!=="string"||result.scope.split(" ").sort().join(" ")!==scopes.split(" ").sort().join(" "))throw new Error("STORE_PROOF_INVALID");
 const credentials={accessToken:str(result.access_token),context},info=await fixedJson("https://api.bigcommerce.com/"+context+"/v2/store",{headers:{"X-Auth-Token":credentials.accessToken}});
 return {provider,providerId:context,storeUrl:storeAddress(str(info.secure_url??info.domain)),name:typeof info.name==="string"?info.name:context,credentials};
}
