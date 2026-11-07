export type PaidBinding={provider:"meta"|"tiktok";accountId:string;adId:string;token:string};
const id=(s:string)=>/^[0-9]{1,30}$/.test(s);
// Idempotent, pause-only adapter. No code path creates an ad, enables one,
// changes its budget, or follows a redirect with credentials attached.
export async function pausePaidAd(binding:PaidBinding,request:typeof fetch=fetch,version=process.env.META_GRAPH_VERSION){
 if(!id(binding.accountId)||!id(binding.adId)||!binding.token)throw new Error("PAID_AD_BINDING_INVALID");
 const common={redirect:"error" as const,signal:AbortSignal.timeout(15000),cache:"no-store" as const};
 if(binding.provider==="meta"){
  if(!/^v[0-9]{1,2}\.0$/.test(version??""))throw new Error("META_VERSION_NOT_CONFIGURED");
  const url="https://graph.facebook.com/"+version+"/"+binding.adId;
  const headers={Authorization:"Bearer "+binding.token};
  async function state(){const response=await request(url+"?fields=id,account_id,configured_status",{...common,headers});if(!response.ok)throw new Error("PAID_AD_READ_FAILED");const data=await response.json();if(data.id!==binding.adId||data.account_id!==binding.accountId)throw new Error("PAID_AD_ACCOUNT_MISMATCH");return data.configured_status;}
  if(await state()!=="PAUSED"){
   const response=await request(url,{...common,method:"POST",headers:{...headers,"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({status:"PAUSED"})});
   if(!response.ok||(await response.json()).success!==true)throw new Error("PAID_AD_PAUSE_FAILED");
  }
  if(await state()!=="PAUSED")throw new Error("PAID_AD_PAUSE_UNCONFIRMED");return;
 }
 if(binding.provider!=="tiktok")throw new Error("PAID_AD_PROVIDER_INVALID");
 const base="https://business-api.tiktok.com/open_api/v1.3/",headers={"Access-Token":binding.token,"Content-Type":"application/json"};
 async function state(){const query=new URLSearchParams({advertiser_id:binding.accountId,filtering:JSON.stringify({ad_ids:[binding.adId]}),fields:JSON.stringify(["ad_id","advertiser_id","operation_status"])});const response=await request(base+"ad/get/?"+query,{...common,headers});if(!response.ok)throw new Error("PAID_AD_READ_FAILED");const data=await response.json();const ad=data.data?.list?.find((a:{ad_id:string})=>a.ad_id===binding.adId);if(data.code!==0||!ad||ad.advertiser_id!==binding.accountId)throw new Error("PAID_AD_ACCOUNT_MISMATCH");return ad.operation_status;}
 if(await state()!=="DISABLE"){
  const response=await request(base+"ad/status/update/",{...common,method:"POST",headers,body:JSON.stringify({advertiser_id:binding.accountId,ad_ids:[binding.adId],operation_status:"DISABLE"})});if(!response.ok||(await response.json()).code!==0)throw new Error("PAID_AD_PAUSE_FAILED");
 }
 if(await state()!=="DISABLE")throw new Error("PAID_AD_PAUSE_UNCONFIRMED");
}
