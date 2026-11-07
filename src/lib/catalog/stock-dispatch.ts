import "server-only";
import {createAdminClient} from "@/lib/supabase/admin";
import {inngest} from "@/inngest/client";
export async function dispatchStockPauses(connectionId:string){
 const {data,error}=await createAdminClient().from("catalog_stock_pauses").select("id,requested_at,catalog_ad_bindings!inner(catalog_items!inner(connection_id))").eq("status","pending").eq("catalog_ad_bindings.catalog_items.connection_id",connectionId).limit(100);if(error)throw new Error("STOCK_PAUSE_DISPATCH_FAILED");
 if(data?.length)await inngest.send(data.map(p=>({id:"stock-pause-"+p.id+"-"+p.requested_at,name:"catalog/stock.pause",data:{pauseId:p.id}})));
}
