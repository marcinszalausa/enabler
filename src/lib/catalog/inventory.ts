import "server-only";
import {createAdminClient} from "@/lib/supabase/admin";
import {UserError} from "@/lib/errors";

// Check immediately before dispatch, including products imported before a
// store connection. Unknown inventory is never silently interpreted as zero.
export async function assertCatalogStock(workspaceId:string,productId:string){
 const db=createAdminClient();
 const {data:product,error}=await db.from("products").select("url").eq("id",productId).eq("workspace_id",workspaceId).maybeSingle();
 if(error)throw new Error("CATALOG_STOCK_CHECK_FAILED");if(!product)throw new UserError("This product is no longer available.");
 const urls=[product.url];try{const u=new URL(product.url);u.hostname=u.hostname.startsWith("www.")?u.hostname.slice(4):"www."+u.hostname;urls.push(u.toString());}catch{}
 const {data:items,error:read}=await db.from("catalog_items").select("id,inventory_quantity,catalog_connections!inner(enabled)").eq("workspace_id",workspaceId).eq("catalog_connections.enabled",true).in("product_url",urls);
 if(read)throw new Error("CATALOG_STOCK_CHECK_FAILED");
 if(items?.some(item=>item.inventory_quantity===0))throw new UserError("This product is out of stock. Sync your store after restocking before publishing it.");
}
