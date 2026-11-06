import {createHash,createHmac,timingSafeEqual} from "node:crypto";
export const SHOPIFY_SCOPES=["read_products","read_inventory"] as const;
export const SHOPIFY_API_VERSION="2026-10";
export const SHOPIFY_COOKIE="__Host-gooidy-shopify-state";
export function shopDomain(input:unknown){
 if(typeof input!=="string")throw new Error("SHOPIFY_SHOP_INVALID");
 const value=input.trim().toLowerCase().replace(/^https:\/\//,"").replace(/\/$/,"");
 if(!/^[a-z0-9][a-z0-9-]{0,61}\.myshopify\.com$/.test(value))throw new Error("SHOPIFY_SHOP_INVALID");
 return value;
}
export const stateHash=(state:string)=>createHash("sha256").update(state).digest("hex");
export function callbackValid(params:URLSearchParams,secret:string,now=Date.now()){
 const keys=[...params.keys()];
 if(new Set(keys).size!==keys.length||keys.some(k=>!["code","hmac","host","shop","state","timestamp","error","error_description"].includes(k)))return false;
 const hmac=params.get("hmac")??"",timestamp=params.get("timestamp")??"";
 if(!/^[a-f0-9]{64}$/.test(hmac)||!/^\d{10}$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>600)return false;
 const message=new URLSearchParams([...params.entries()].filter(([k])=>k!=="hmac").sort(([a],[b])=>a.localeCompare(b))).toString().replace(/\+/g,"%20");
 return timingSafeEqual(Buffer.from(hmac,"hex"),createHmac("sha256",secret).update(message).digest());
}
export function rawWebhookValid(body:Uint8Array,signature:string,secret:string){
 if(!/^[A-Za-z0-9+/]{43}=$/.test(signature))return false;
 return timingSafeEqual(Buffer.from(signature,"base64"),createHmac("sha256",secret).update(body).digest());
}
export function shopifyConfigured(){
 return process.env.VERCEL_ENV==="production"&&process.env.SHOPIFY_CONNECT_ENABLED==="true"&&!!process.env.SHOPIFY_CLIENT_ID&&!!process.env.SHOPIFY_CLIENT_SECRET&&process.env.SHOPIFY_APP_ORIGIN==="https://gooidy.com"&&process.env.CATALOG_INGESTION_ENABLED==="true"&&/^[a-f0-9]{64}$/i.test(process.env.CATALOG_ENCRYPTION_KEY??"")&&!!process.env.INNGEST_EVENT_KEY&&!!process.env.INNGEST_SIGNING_KEY;
}
export function authorizationUrl(shop:string,state:string){
 const url=new URL("https://"+shopDomain(shop)+"/admin/oauth/authorize");
 url.search=new URLSearchParams({client_id:process.env.SHOPIFY_CLIENT_ID!,scope:SHOPIFY_SCOPES.join(","),redirect_uri:"https://gooidy.com/api/shopify/callback",state}).toString();return url.toString();
}
export function hasScopes(value:string){const scopes=new Set(value.split(","));return SHOPIFY_SCOPES.every(s=>scopes.has(s));}
