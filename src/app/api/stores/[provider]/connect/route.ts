import {randomBytes} from "node:crypto";
import {cookies} from "next/headers";
import {createAdminClient} from "@/lib/supabase/admin";
import {verifyPublicUrl} from "@/lib/public-fetch";
import {catalogBody} from "@/lib/catalog/security";
import {catalogStoreOwner,catalogSameOrigin} from "@/lib/catalog/auth";
import {storeProvider,storeAddress,storeKey,providerReady,providerInstallUrl,intentHash,STORE_COOKIE} from "@/lib/stores/providers";
export async function POST(request:Request,{params}:{params:Promise<{provider:string}>}){
 const finish=(notice:string)=>Response.redirect("https://gooidy.com/dashboard/stores?notice="+notice,303);
 try{
  catalogSameOrigin(request);const provider=storeProvider((await params).provider);
  const form=new URLSearchParams((await catalogBody(request,16384)).toString()),ws=form.get("workspaceId");
  const client=await catalogStoreOwner(ws);if(!providerReady(provider))return finish("platform_unavailable");
  const {data:{user}}=await client.auth.getUser();if(!user)throw new Error("AUTH");
  const needsAddress=provider==="woocommerce"||provider==="bigcommerce";
  const raw=form.get("storeUrl"),address=typeof raw==="string"&&raw.trim()?storeAddress(raw):null;
  if(needsAddress&&!address)throw new Error("STORE_ADDRESS_REQUIRED");if(address)await verifyPublicUrl(address);
  const state=randomBytes(32).toString("hex");
  const {error}=await createAdminClient().from("store_connect_intents").insert({state_hash:intentHash(state),workspace_id:ws,user_id:user.id,provider,expected_url:address,expected_key:address?storeKey(address):null,expires_at:new Date(Date.now()+600000).toISOString()});if(error)throw new Error("STORE_STATE_FAILED");
  (await cookies()).set(STORE_COOKIE,state,{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:600});
  return Response.redirect(providerInstallUrl(provider,address??"",state),303);
 }catch(e){return finish(e instanceof Error&&e.message==="CATALOG_UPGRADE_REQUIRED"?"upgrade":"platform_error");}
}
