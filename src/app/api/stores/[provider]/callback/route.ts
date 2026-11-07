import {cookies} from "next/headers";
import {catalogBody} from "@/lib/catalog/security";
import {canConnectStores} from "@/lib/catalog/access";
import {createAdminClient} from "@/lib/supabase/admin";
import {storeProvider,providerReady,intentHash,STORE_COOKIE} from "@/lib/stores/providers";
import {authorizeProof,obj} from "@/lib/stores/api";
import {pendingIntent,stageInstallation,continueInstallation} from "@/lib/stores/flow";
const finish=(notice:string)=>Response.redirect("https://gooidy.com/dashboard/stores?notice="+notice,303);
export const maxDuration=60;
export async function POST(request:Request,{params}:{params:Promise<{provider:string}>}){
 try{
  const provider=storeProvider((await params).provider);if(provider!=="woocommerce"||!providerReady(provider))return new Response(null,{status:503});
  const query=new URL(request.url).searchParams,state=query.get("state")??"",intent=await pendingIntent(state,provider);
  if(!await canConnectStores(intent.workspace_id))return new Response(null,{status:403});
  const body=obj(JSON.parse((await catalogBody(request,16384)).toString()));if(body.user_id!==state)throw new Error("STORE_PROOF_INVALID");
  const proof=await authorizeProof(provider,query,body,intent.expected_url),claim=await stageInstallation(proof,intentHash(state));
  const {data:saved,error}=await createAdminClient().from("store_connect_intents").update({receipt_hash:intentHash(claim)}).eq("state_hash",intentHash(state)).is("receipt_hash",null).select("state_hash").maybeSingle();if(error||!saved)throw new Error("STORE_PROOF_SAVE_FAILED");
  return Response.json({received:true});
 }catch{return new Response(null,{status:400});}
}
export async function GET(request:Request,{params}:{params:Promise<{provider:string}>}){
 try{
  const provider=storeProvider((await params).provider);if(!providerReady(provider))return finish("platform_unavailable");
  const query=new URL(request.url).searchParams;
  if(new Set(query.keys()).size!==[...query.keys()].length)throw new Error("STORE_PROOF_INVALID");
  if(query.has("error")||provider==="woocommerce"&&query.get("success")!=="1")return finish("canceled");
  if(provider==="woocommerce"){
   const state=query.get("user_id")??"";if((await cookies()).get(STORE_COOKIE)?.value!==state)throw new Error("STORE_STATE_INVALID");
   const intent=await pendingIntent(state,provider);if(!intent.receipt_hash)return finish("platform_error");
   return Response.redirect("https://gooidy.com/api/stores/complete?receipt="+intent.receipt_hash,303);
  }
  let intent:string|null=null;
  if(provider!=="bigcommerce"){
   const state=query.get("state")??"";if((await cookies()).get(STORE_COOKIE)?.value!==state)throw new Error("STORE_STATE_INVALID");
   const pending=await pendingIntent(state,provider);if(!await canConnectStores(pending.workspace_id))return finish("upgrade");intent=intentHash(state);
  }
  const proof=await authorizeProof(provider,query,null,null),claim=await stageInstallation(proof,intent);
  if(provider==="bigcommerce")return continueInstallation(claim);
  return Response.redirect("https://gooidy.com/api/stores/complete?claim="+claim,303);
 }catch{return finish("platform_error");}
}
