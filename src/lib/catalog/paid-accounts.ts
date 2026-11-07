import "server-only";
import {createHash,randomBytes} from "node:crypto";
import {cookies} from "next/headers";
import {createAdminClient} from "@/lib/supabase/admin";
import {createClient} from "@/lib/supabase/server";
import {catalogOwner,catalogStoreOwner} from "./auth";
import {encryptCatalogSecret,decryptCatalogSecret} from "./security";
import {paidIntentMatches} from "./paid-connect-policy";
export type PaidProvider="meta"|"tiktok";
export type PaidAccountChoice={id:string;name:string};
export type PaidAdChoice={id:string;name:string};
export async function paidAccountSummaries(workspaceId:string){
 await catalogOwner(workspaceId);const {data,error}=await createAdminClient().from("catalog_ad_accounts").select("id,provider,external_account_id,name,enabled,token_expires_at").eq("workspace_id",workspaceId).order("name");if(error)throw new Error("Could not load paid ad accounts");const now=Date.now();return (data??[]).map(a=>({...a,reconnectRequired:!!a.token_expires_at&&Date.parse(a.token_expires_at)<=now}));
}
type Receipt={token:string;accounts:PaidAccountChoice[];expiresAt:string|null};
const COOKIE="gooidy-paid-ad-connect",base="https://gooidy.com",hash=(s:string)=>createHash("sha256").update(s).digest("hex");
export function paidProvider(v:unknown):PaidProvider{if(v!=="meta"&&v!=="tiktok")throw new Error("PAID_PROVIDER_INVALID");return v;}
export function paidProviderReady(provider:PaidProvider){
 const env=process.env,prefix=provider==="meta"?"META_ADS":"TIKTOK_ADS";
 return env.VERCEL_ENV==="production"&&env.CATALOG_INGESTION_ENABLED==="true"&&/^[a-f0-9]{64}$/i.test(env.CATALOG_ENCRYPTION_KEY??"")&&env[prefix+"_CONNECT_ENABLED"]==="true"&&/^[0-9]{3,50}$/.test(env[prefix+"_APP_ID"]??"")&&!!env[prefix+"_APP_SECRET"]&&(provider!=="meta"||/^v[0-9]{1,2}\.0$/.test(env.META_GRAPH_VERSION??""));
}
function callback(provider:PaidProvider){return base+"/api/catalog/ad-accounts/"+provider+"/callback";}
async function providerJson(url:string,init:RequestInit={}){
 const u=new URL(url);if(!["graph.facebook.com","business-api.tiktok.com"].includes(u.hostname)||u.protocol!=="https:")throw new Error("PAID_PROVIDER_URL_INVALID");
 const response=await fetch(url,{...init,redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error("PAID_PROVIDER_REQUEST_FAILED");const data=await response.json();if(data.error||typeof data.code==="number"&&data.code!==0)throw new Error("PAID_PROVIDER_REQUEST_FAILED");return data;
}
function token(value:unknown){if(typeof value!=="string"||value.length<10||value.length>8192)throw new Error("PAID_TOKEN_INVALID");return value;}
function accountId(value:unknown){const s=String(value??"");if(!/^[0-9]{1,30}$/.test(s))throw new Error("PAID_ACCOUNT_INVALID");return s;}
export async function beginPaidConnection(workspaceId:string,provider:PaidProvider){
 if(!paidProviderReady(provider))throw new Error("PAID_CONNECT_UNAVAILABLE");const client=await catalogStoreOwner(workspaceId),{data:{user}}=await client.auth.getUser();if(!user)throw new Error("CATALOG_SIGN_IN_REQUIRED");
 const state=randomBytes(32).toString("hex"),nonce=randomBytes(32).toString("hex");
 const {error}=await createAdminClient().from("catalog_ad_connect_intents").insert({workspace_id:workspaceId,user_id:user.id,provider,state_hash:hash(state),nonce_hash:hash(nonce),expires_at:new Date(Date.now()+600000).toISOString()});if(error)throw new Error("PAID_CONNECT_STATE_FAILED");
 (await cookies()).set(COOKIE,nonce,{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:600});
 const url=new URL(provider==="meta"?"https://www.facebook.com/"+process.env.META_GRAPH_VERSION+"/dialog/oauth":"https://business-api.tiktok.com/portal/auth");
 url.searchParams.set(provider==="meta"?"client_id":"app_id",process.env[provider==="meta"?"META_ADS_APP_ID":"TIKTOK_ADS_APP_ID"]!);url.searchParams.set("state",state);url.searchParams.set("redirect_uri",callback(provider));
 if(provider==="meta"){url.searchParams.set("scope","ads_read,ads_management");url.searchParams.set("response_type","code");}return url.toString();
}
async function authenticatedIntent(id:string,byState=false){
 if(!(byState?/^[a-f0-9]{64}$/:/^[a-f0-9-]{36}$/).test(id))throw new Error("PAID_CONNECT_STATE_INVALID");
 const nonce=(await cookies()).get(COOKIE)?.value;if(!nonce||!/^[a-f0-9]{64}$/.test(nonce))throw new Error("PAID_CONNECT_STATE_INVALID");
 const client=await createClient(),{data:{user}}=await client.auth.getUser();if(!user)throw new Error("CATALOG_SIGN_IN_REQUIRED");
 const {data,error}=await createAdminClient().from("catalog_ad_connect_intents").select("*").eq(byState?"state_hash":"id",byState?hash(id):id).eq("user_id",user.id).eq("nonce_hash",hash(nonce)).gt("expires_at",new Date().toISOString()).maybeSingle();
 if(error||!data||!paidIntentMatches(data,user.id,nonce))throw new Error("PAID_CONNECT_STATE_INVALID");await catalogStoreOwner(data.workspace_id);return data;
}
export async function completePaidOAuth(provider:PaidProvider,state:string,code:string){
 if(!paidProviderReady(provider)||!code||code.length>4096)throw new Error("PAID_CONNECT_UNAVAILABLE");const intent=await authenticatedIntent(state,true);if(intent.provider!==provider||intent.status!=="pending")throw new Error("PAID_CONNECT_STATE_INVALID");
 const db=createAdminClient(),{data:claimed,error}=await db.from("catalog_ad_connect_intents").update({status:"exchanging"}).eq("id",intent.id).eq("status","pending").select("id").maybeSingle();if(error||!claimed)throw new Error("PAID_CONNECT_STATE_INVALID");
 let receipt:Receipt;
 if(provider==="meta"){
  const graph="https://graph.facebook.com/"+process.env.META_GRAPH_VERSION;
  const exchange=new URL(graph+"/oauth/access_token");for(const [key,value] of Object.entries({client_id:process.env.META_ADS_APP_ID!,client_secret:process.env.META_ADS_APP_SECRET!,redirect_uri:callback(provider),code}))exchange.searchParams.set(key,value);
  const initial=await providerJson(exchange.toString());const long=new URL(graph+"/oauth/access_token");for(const [key,value] of Object.entries({grant_type:"fb_exchange_token",client_id:process.env.META_ADS_APP_ID!,client_secret:process.env.META_ADS_APP_SECRET!,fb_exchange_token:token(initial.access_token)}))long.searchParams.set(key,value);
  const credentials=await providerJson(long.toString()),access=token(credentials.access_token),headers={Authorization:"Bearer "+access};
  const permissions=await providerJson(graph+"/me/permissions",{headers});if(!permissions.data?.some((p:{permission:string;status:string})=>p.permission==="ads_management"&&p.status==="granted"))throw new Error("PAID_MANAGE_PERMISSION_REQUIRED");
  const accounts:PaidAccountChoice[]=[];let after:string|null=null;
  for(let page=0;page<10;page++){const query=new URLSearchParams({fields:"account_id,name",limit:"100",...(after?{after}:{})});const data=await providerJson(graph+"/me/adaccounts?"+query,{headers});for(const account of data.data??[])accounts.push({id:accountId(account.account_id),name:String(account.name??account.account_id).slice(0,200)});after=data.paging?.cursors?.after??null;if(!data.paging?.next)break;if(!after||after.length>2048)throw new Error("PAID_ACCOUNT_CURSOR_INVALID");}
  if(!accounts.length)throw new Error("PAID_ACCOUNT_ACCESS_REQUIRED");const seconds=Number(credentials.expires_in);if(!Number.isSafeInteger(seconds)||seconds<1)throw new Error("PAID_TOKEN_EXPIRY_INVALID");receipt={token:access,accounts,expiresAt:new Date(Date.now()+seconds*1000).toISOString()};
 }else{
  const result=await providerJson("https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({app_id:process.env.TIKTOK_ADS_APP_ID,secret:process.env.TIKTOK_ADS_APP_SECRET,auth_code:code,return_advertiser_ids:true})});
  const access=token(result.data?.access_token);const query=new URLSearchParams({app_id:process.env.TIKTOK_ADS_APP_ID!,secret:process.env.TIKTOK_ADS_APP_SECRET!});
  const data=await providerJson("https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/?"+query,{headers:{"Access-Token":access}}),accounts=(data.data?.list??[]).map((a:{advertiser_id:unknown;advertiser_name?:unknown})=>({id:accountId(a.advertiser_id),name:String(a.advertiser_name??a.advertiser_id).slice(0,200)}));if(!accounts.length)throw new Error("PAID_ACCOUNT_ACCESS_REQUIRED");
  const seconds=Number(result.data?.expires_in);receipt={token:access,accounts,expiresAt:Number.isSafeInteger(seconds)&&seconds>0?new Date(Date.now()+seconds*1000).toISOString():null};
 }
 const {error:save}=await db.from("catalog_ad_connect_intents").update({status:"authorized",credentials_cipher:encryptCatalogSecret(JSON.stringify(receipt))}).eq("id",intent.id).eq("status","exchanging");if(save)throw new Error("PAID_CONNECT_SAVE_FAILED");return intent.id;
}
export async function paidAccountChoices(intentId:string,workspaceId:string){
 const intent=await authenticatedIntent(intentId);if(intent.workspace_id!==workspaceId||intent.status!=="authorized"||!intent.credentials_cipher)throw new Error("PAID_CONNECT_STATE_INVALID");const receipt=JSON.parse(decryptCatalogSecret(intent.credentials_cipher)) as Receipt;return {intent,receipt};
}
export async function savePaidAccount(intentId:string,workspaceId:string,chosen:string){
 const {intent,receipt}=await paidAccountChoices(intentId,workspaceId),account=receipt.accounts.find(a=>a.id===chosen);if(!account||receipt.expiresAt&&Date.parse(receipt.expiresAt)<=Date.now())throw new Error("PAID_ACCOUNT_INVALID");
 const {data,error}=await createAdminClient().rpc("finalize_catalog_ad_account",{intent_id:intent.id,actor:intent.user_id,nonce:intent.nonce_hash,external:account.id,account_name:account.name,encrypted_token:encryptCatalogSecret(receipt.token),expiry:receipt.expiresAt});if(error||!data)throw new Error("PAID_ACCOUNT_SAVE_FAILED");
 (await cookies()).delete(COOKIE);return data as string;
}
export async function loadPaidAccount(id:string,workspaceId:string){
 await catalogStoreOwner(workspaceId);const {data,error}=await createAdminClient().from("catalog_ad_accounts").select("*").eq("id",id).eq("workspace_id",workspaceId).eq("enabled",true).maybeSingle();if(error||!data||data.token_expires_at&&Date.parse(data.token_expires_at)<=Date.now())throw new Error("PAID_ACCOUNT_RECONNECT_REQUIRED");return data;
}
export async function listPaidAds(account:Record<string,string>,cursor="",onlyId?:string):Promise<{ads:PaidAdChoice[];next:string|null}>{
 const access=decryptCatalogSecret(account.credentials_cipher),id=accountId(account.external_account_id);
 if(account.provider==="meta"){
  if(!/^v[0-9]{1,2}\.0$/.test(process.env.META_GRAPH_VERSION??"")||cursor.length>2048)throw new Error("PAID_PROVIDER_INVALID");
  const query=new URLSearchParams({fields:"id,account_id,name,status",...(onlyId?{}:{limit:"50",effective_status:JSON.stringify(["ACTIVE"])}),...(cursor?{after:cursor}:{})});
  const data=await providerJson("https://graph.facebook.com/"+process.env.META_GRAPH_VERSION+"/"+(onlyId?accountId(onlyId):"act_"+id+"/ads")+"?"+query,{headers:{Authorization:"Bearer "+access}});
  const rows=onlyId?[data]:data.data??[];if(rows.some((a:{account_id:string})=>a.account_id!==id))throw new Error("PAID_AD_ACCOUNT_MISMATCH");return {ads:rows.map((a:{id:string;name:string})=>({id:accountId(a.id),name:String(a.name??a.id).slice(0,200)})),next:data.paging?.next?data.paging?.cursors?.after??null:null};
 }
 const page=cursor?Number(cursor):1;if(!Number.isInteger(page)||page<1||page>1000)throw new Error("PAID_AD_CURSOR_INVALID");
 const query=new URLSearchParams({advertiser_id:id,fields:JSON.stringify(["ad_id","advertiser_id","ad_name"]),page:String(page),page_size:"50",filtering:JSON.stringify(onlyId?{ad_ids:[accountId(onlyId)]}:{operation_status:"ENABLE"})});
 const data=await providerJson("https://business-api.tiktok.com/open_api/v1.3/ad/get/?"+query,{headers:{"Access-Token":access}}),rows=data.data?.list??[];if(rows.some((a:{advertiser_id:string})=>a.advertiser_id!==id))throw new Error("PAID_AD_ACCOUNT_MISMATCH");return {ads:rows.map((a:{ad_id:string;ad_name:string})=>({id:accountId(a.ad_id),name:String(a.ad_name??a.ad_id).slice(0,200)})),next:Number(data.data?.page_info?.total_page)>page?String(page+1):null};
}
