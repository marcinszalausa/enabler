import {createAdminClient} from "@/lib/supabase/admin";
import {catalogOwner,catalogStoreOwner} from "@/lib/catalog/auth";
import {catalogBody} from "@/lib/catalog/security";
import {savePaidAccount} from "@/lib/catalog/paid-accounts";
export async function POST(request:Request){
 const headers={"Cache-Control":"private, no-store"};if(request.headers.get("origin")!==new URL(request.url).origin)return Response.json({code:"ACCESS_DENIED"},{status:403,headers});
 try{const input=JSON.parse((await catalogBody(request,4096)).toString());if(input.action==="save"){await catalogStoreOwner(input.workspaceId);await savePaidAccount(String(input.intentId),input.workspaceId,String(input.accountId));}
 else if(input.action==="disconnect"){await catalogOwner(input.workspaceId);const {error}=await createAdminClient().from("catalog_ad_accounts").update({enabled:false,credentials_cipher:""}).eq("id",String(input.accountId)).eq("workspace_id",input.workspaceId);if(error)throw new Error("PAID_DISCONNECT_FAILED");}else throw new Error("INVALID_REQUEST");return Response.json({saved:true},{headers});
 }catch{return Response.json({code:"PAID_ACCOUNT_ACTION_FAILED"},{status:409,headers});}
}
