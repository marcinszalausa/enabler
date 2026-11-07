import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {photoReviewItem} from "@/lib/catalog/photo-access";
import {loadPaidAccount,listPaidAds} from "@/lib/catalog/paid-accounts";
import {catalogBody,decryptCatalogSecret} from "@/lib/catalog/security";
import {pausePaidAd} from "@/lib/catalog/paid-ad-pause";
export const maxDuration=120;
const reply=(code:string,status:number)=>Response.json({code},{status,headers:{"Cache-Control":"private, no-store"}});
export async function GET(request:Request){
 try{const q=new URL(request.url).searchParams,item=await photoReviewItem(await createClient(),q.get("itemId")??"");if(!item)return reply("ACCESS_DENIED",403);const account=await loadPaidAccount(q.get("accountId")??"",item.workspace_id);return Response.json(await listPaidAds(account,q.get("cursor")??""),{headers:{"Cache-Control":"private, no-store"}});}catch{return reply("PAID_ADS_UNAVAILABLE",503);}
}
export async function POST(request:Request){
 if(request.headers.get("origin")!==new URL(request.url).origin)return reply("ACCESS_DENIED",403);
 try{const input=JSON.parse((await catalogBody(request,4096)).toString()),client=await createClient(),item=await photoReviewItem(client,input.itemId);if(!item)return reply("ACCESS_DENIED",403);
  if(input.stockConsent!==true)return reply("STOCK_CONSENT_REQUIRED",400);
  const account=await loadPaidAccount(String(input.accountId),item.workspace_id),ads=await listPaidAds(account,"",String(input.adId));if(!ads.ads.some(a=>a.id===input.adId))return reply("PAID_AD_ACCOUNT_MISMATCH",403);
  let status="active";if(item.inventory_quantity===0){await pausePaidAd({provider:account.provider,accountId:account.external_account_id,adId:input.adId,token:decryptCatalogSecret(account.credentials_cipher)});status="paused";}
  const {data:{user}}=await client.auth.getUser();if(!user)return reply("ACCESS_DENIED",403);
  const {error}=await createAdminClient().rpc("bind_catalog_paid_ad",{item:item.id,account:account.id,external:input.adId,actor:user.id,binding_status:status});if(error)return reply("STOCK_OR_BINDING_CHANGED",409);return Response.json({linked:true,paused:status==="paused"},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return reply("PAID_AD_LINK_FAILED",503);}
}
