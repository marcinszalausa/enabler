import {randomBytes} from "node:crypto";
import {cookies} from "next/headers";
import {createAdminClient} from "@/lib/supabase/admin";
import {catalogBody} from "@/lib/catalog/security";
import {catalogOwner,catalogSameOrigin} from "@/lib/catalog/auth";
import {shopDomain,shopifyConfigured,authorizationUrl,stateHash,SHOPIFY_COOKIE} from "@/lib/shopify/security";
export async function POST(request:Request){
 if(!shopifyConfigured())return Response.json({error:"Shopify connection is temporarily unavailable."},{status:503});
 try{
  catalogSameOrigin(request);const form=new URLSearchParams((await catalogBody(request,16384)).toString()),workspaceId=form.get("workspaceId"),shop=shopDomain(form.get("shop"));
  const userClient=await catalogOwner(workspaceId);const {data:{user}}=await userClient.auth.getUser();if(!user)throw new Error("AUTH");
  const state=randomBytes(32).toString("hex");
  const {error}=await createAdminClient().from("shopify_oauth_states").insert({state_hash:stateHash(state),workspace_id:workspaceId,user_id:user.id,shop,expires_at:new Date(Date.now()+600000).toISOString()});if(error)throw new Error("WRITE");
  (await cookies()).set(SHOPIFY_COOKIE,state,{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:600});
  return Response.redirect(authorizationUrl(shop,state),303);
 }catch{return Response.redirect("https://gooidy.com/dashboard/stores?notice=connect_error",303);}
}
