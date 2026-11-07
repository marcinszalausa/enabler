import {createHash,createHmac,timingSafeEqual} from "node:crypto";
import {parsePublicHttpUrl} from "../public-fetch.ts";
export const STORE_PROVIDERS=[{id:"woocommerce",name:"WooCommerce"},{id:"wix",name:"Wix"},{id:"squarespace",name:"Squarespace"},{id:"bigcommerce",name:"BigCommerce"}] as const;
export type StoreProvider=typeof STORE_PROVIDERS[number]["id"];
export const STORE_COOKIE="__Host-gooidy-store-state";
export const intentHash=(value:string)=>createHash("sha256").update(value).digest("hex");
export function storeProvider(value:unknown):StoreProvider{if(!STORE_PROVIDERS.some(p=>p.id===value))throw new Error("STORE_PROVIDER_INVALID");return value as StoreProvider;}
export function storeAddress(input:unknown){
 if(typeof input!=="string"||input.length>2048)throw new Error("STORE_ADDRESS_INVALID");
 const raw=input.trim(),url=parsePublicHttpUrl(/^https?:\/\//i.test(raw)?raw:"https://"+raw);
 if(url.protocol!=="https:"||url.search||url.hash)throw new Error("STORE_ADDRESS_INVALID");
 url.pathname=url.pathname.replace(/\/$/,"");return url.toString().replace(/\/$/,"");
}
export function storeKey(url:string){const parsed=new URL(storeAddress(url));parsed.hostname=parsed.hostname.replace(/^www\./,"");return parsed.toString().replace(/\/$/,"");}
export function providerReady(provider:StoreProvider){
 const core=process.env.VERCEL_ENV==="production"&&process.env.CATALOG_INGESTION_ENABLED==="true"&&/^[a-f0-9]{64}$/i.test(process.env.CATALOG_ENCRYPTION_KEY??"")&&!!process.env.INNGEST_EVENT_KEY&&!!process.env.INNGEST_SIGNING_KEY;
 const prefix=provider.toUpperCase();return core&&process.env[prefix+"_CONNECT_ENABLED"]==="true"&&(provider==="woocommerce"||!!process.env[prefix+"_CLIENT_ID"]&&!!process.env[prefix+"_CLIENT_SECRET"]&&(provider!=="wix"||!!process.env.WIX_INSTALL_URL));
}
export function callbackUrl(provider:StoreProvider){return "https://gooidy.com/api/stores/"+provider+"/callback";}
export function providerInstallUrl(provider:StoreProvider,store:string,state:string){
 if(provider==="woocommerce"){
  const url=new URL(storeAddress(store)+"/wc-auth/v1/authorize");url.search=new URLSearchParams({app_name:"Gooidy",scope:"read",user_id:state,return_url:callbackUrl(provider)+"?phase=return",callback_url:callbackUrl(provider)+"?state="+state}).toString();return url.toString();
 }
 if(provider==="squarespace"){
  const url=new URL("https://login.squarespace.com/api/1/login/oauth/provider/authorize");url.search=new URLSearchParams({client_id:process.env.SQUARESPACE_CLIENT_ID!,redirect_uri:callbackUrl(provider),scope:"website.products.read,website.inventory.read",state,access_type:"offline"}).toString();return url.toString();
 }
 if(provider==="bigcommerce")return "https://login.bigcommerce.com/app/"+encodeURIComponent(process.env.BIGCOMMERCE_CLIENT_ID!)+"/install";
 const url=new URL(process.env.WIX_INSTALL_URL!);if(url.protocol!=="https:"||url.hostname!=="www.wix.com"||url.username||url.password)throw new Error("STORE_CONFIGURATION_INVALID");
 url.searchParams.set("appId",process.env.WIX_CLIENT_ID!);url.searchParams.set("postInstallationUrl",callbackUrl(provider)+"?state="+state);if(process.env.WIX_SHARE_URL_ID)url.searchParams.set("shareUrlId",process.env.WIX_SHARE_URL_ID);return url.toString();
}
export function verifyWixInstance(value:string,instanceId:string,secret:string){
 const parts=value.split(".");if(parts.length!==2||value.length>16384)throw new Error("STORE_PROOF_INVALID");
 const signature=Buffer.from(parts[0],"base64url"),expected=createHmac("sha256",secret).update(parts[1]).digest();
 if(signature.length!==expected.length||!timingSafeEqual(signature,expected))throw new Error("STORE_PROOF_INVALID");
 const data=JSON.parse(Buffer.from(parts[1],"base64url").toString());
 if(data.instanceId!==instanceId||!Number.isFinite(Date.parse(data.signDate))||Math.abs(Date.now()-Date.parse(data.signDate))>600000)throw new Error("STORE_PROOF_INVALID");return data;
}
