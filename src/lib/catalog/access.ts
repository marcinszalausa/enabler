import "server-only";
import {createAdminClient} from "@/lib/supabase/admin";
export async function canConnectStores(workspaceId:string){
 const {data,error}=await createAdminClient().rpc("can_connect_store",{ws:workspaceId});
 if(error)throw new Error("CATALOG_ACCESS_CHECK_FAILED");return data===true;
}
export async function requireStorePlan(workspaceId:string){if(!await canConnectStores(workspaceId))throw new Error("CATALOG_UPGRADE_REQUIRED");}
