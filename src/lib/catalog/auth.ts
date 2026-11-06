import "server-only";
import {requireStorePlan} from "./access";
import {createClient} from "@/lib/supabase/server";
export async function catalogOwner(workspaceId:unknown){
 if(typeof workspaceId!=="string"||!/^[a-f0-9-]{36}$/i.test(workspaceId))throw new Error("CATALOG_WORKSPACE_INVALID");
 const db=await createClient();const {data:{user},error}=await db.auth.getUser();if(error||!user)throw new Error("CATALOG_SIGN_IN_REQUIRED");
 const {data,error:roleError}=await db.rpc("is_workspace_member",{ws:workspaceId,min_role:"owner"});if(roleError||data!==true)throw new Error("CATALOG_OWNER_REQUIRED");return db;
}
export function catalogSameOrigin(request:Request){const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)throw new Error("CATALOG_ORIGIN_INVALID");}

export async function catalogStoreOwner(workspaceId:unknown){const client=await catalogOwner(workspaceId);await requireStorePlan(workspaceId as string);return client;}
