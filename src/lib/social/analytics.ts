import "server-only";
import {parseMetrics,type Metrics} from "@/lib/customer-workflow";
export type PostAnalytics = {state:"ready"|"pending"|"unavailable"|"addon";metrics:Metrics|null;updated:string|null};
// Only call with a post ID already read through the customer's workspace RLS.
export async function getPostAnalytics(postId:string):Promise<PostAnalytics>{
 const unavailable:PostAnalytics={state:"unavailable",metrics:null,updated:null};
 if(!process.env.ZERNIO_API_KEY)return unavailable;
 try{
  const url=new URL("https://zernio.com/api/v1/analytics");url.searchParams.set("postId",postId);
  const response=await fetch(url,{headers:{authorization:`Bearer ${process.env.ZERNIO_API_KEY}`},cache:"no-store",signal:AbortSignal.timeout(8000)});
  if(response.status===402||response.status===403)return {...unavailable,state:"addon"};
  if(response.status===202)return {...unavailable,state:"pending"};
  if(!response.ok)return unavailable;
  const text=await response.text();if(text.length>200000)return unavailable;
  const value:unknown=JSON.parse(text);
  if(!value||typeof value!=="object"||Array.isArray(value))return unavailable;
  const data=value as Record<string,unknown>;
  // External IDs can be resolved by the provider; latePostId ties it back.
  if(data.postId!==postId&&data.latePostId!==postId)return unavailable;
  if(data.syncStatus==="pending")return {...unavailable,state:"pending"};
  if(data.syncStatus!=="synced")return unavailable;
  const metrics=parseMetrics(data.analytics);
  const updated=(data.analytics as {lastUpdated?:unknown}|null)?.lastUpdated;
  return metrics?{state:"ready",metrics,updated:typeof updated==="string"&&Number.isFinite(Date.parse(updated))?updated:null}:unavailable;
 }catch{return unavailable;}
}
