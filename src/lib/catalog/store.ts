import "server-only";
import {requireStorePlan} from "./access";
import {createHash} from "node:crypto";
import {createAdminClient} from "@/lib/supabase/admin";
import type {CatalogConnection,CatalogProduct} from "./normalize";
export async function receiveCatalog(c:CatalogConnection,eventId:string,body:Uint8Array,products:CatalogProduct[]){
 if(!/^[A-Za-z0-9._:-]{1,180}$/.test(eventId))throw new Error("CATALOG_EVENT_ID_INVALID");
 await requireStorePlan(c.workspace_id);
 const db=createAdminClient(),hash=createHash("sha256").update(body).digest("hex");
 const {data,error}=await db.from("catalog_deliveries").insert({connection_id:c.id,workspace_id:c.workspace_id,event_id:eventId,body_hash:hash,products}).select("id").single();
 if(!error&&data)return data.id as string;if(error?.code!=="23505")throw new Error("CATALOG_RECEIPT_WRITE_FAILED");
 const {data:old,error:read}=await db.from("catalog_deliveries").select("id,body_hash").eq("connection_id",c.id).eq("event_id",eventId).single();if(read||!old||old.body_hash!==hash)throw new Error("CATALOG_EVENT_CONFLICT");return old.id as string;
}
export async function loadConnection(id:string){const db=createAdminClient();const {data,error}=await db.from("catalog_connections").select("*").eq("id",id).single();if(error||!data?.enabled)throw new Error("CATALOG_CONNECTION_DISABLED");await requireStorePlan(data.workspace_id);return data as CatalogConnection;}
export async function jobStatus(id:string,patch:Record<string,unknown>){const {error}=await createAdminClient().from("catalog_training_jobs").update(patch).eq("id",id);if(error)throw new Error("CATALOG_JOB_WRITE_FAILED");}
