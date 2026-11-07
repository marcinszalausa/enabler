import "server-only";
import type {SupabaseClient} from "@supabase/supabase-js";

export type ReviewItem={id:string;workspace_id:string;connection_id:string;name:string;product_url:string;images:unknown;image_revision:string;inventory_quantity:number|null};
export const validCatalogId=(value:unknown):value is string=>typeof value==="string"&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);

// The authenticated client and database RLS must establish access before any
// image download. Browser-supplied image URLs and workspace IDs are never used.
export async function photoReviewItem(client:SupabaseClient,id:string):Promise<ReviewItem|null>{
 if(!validCatalogId(id))return null;
 const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)return null;
 const {data:item,error}=await client.from("catalog_items").select("id,workspace_id,connection_id,name,product_url,images,image_revision,inventory_quantity").eq("id",id).maybeSingle();if(error)throw new Error("CATALOG_REVIEW_READ_FAILED");if(!item)return null;
 const [plan,owner,connection]=await Promise.all([
  client.rpc("can_connect_store",{ws:item.workspace_id}),
  client.rpc("is_workspace_member",{ws:item.workspace_id,min_role:"owner"}),
  client.from("catalog_connections").select("id").eq("id",item.connection_id).eq("workspace_id",item.workspace_id).eq("enabled",true).maybeSingle(),
 ]);
 if(plan.error||owner.error||connection.error)throw new Error("CATALOG_REVIEW_ACCESS_FAILED");
 return plan.data===true&&owner.data===true&&connection.data?item as ReviewItem:null;
}

// Best-effort per-instance compute limits, in addition to paid owner access.
// No automatic retries and no paid provider calls are made by a photo check.
export class PhotoCheckBudget{
 private active=0;
 private recent=new Map<string,number>();
 take(workspace:string,now=Date.now()){
  for(const [key,at] of this.recent)if(now-at>=60000)this.recent.delete(key);
  if(this.active>=2||this.recent.has(workspace)||this.recent.size>=200)return false;
  this.recent.set(workspace,now);this.active++;return true;
 }
 release(){this.active=Math.max(0,this.active-1);}
}
