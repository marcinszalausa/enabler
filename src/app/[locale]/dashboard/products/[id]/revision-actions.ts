"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canEditWorkspace, WORKSPACE_WRITE_DENIED } from "@/lib/workspace-access";
import { copyEdits } from "@/lib/customer-workflow";
export type RevisionState = { error: string | null; saved: boolean };
export async function saveAdCopy(_previous: RevisionState, form: FormData): Promise<RevisionState> {
  const db=await createClient();
  const {data:auth}=await db.auth.getUser();
  if(!auth.user)return {error:"Sign in again before editing this ad.",saved:false};
  const {data:creative,error}=await db.from("creatives").select("id,workspace_id,kind,headline,primary_text,cta,generations!inner(product_id,status,showcased_at)").eq("id",String(form.get("creativeId")??"")).maybeSingle();
  if(error||!creative)return {error:"This ad could not be loaded.",saved:false};
  if(!(await canEditWorkspace(db,creative.workspace_id)))return {error:WORKSPACE_WRITE_DENIED,saved:false};
  const run=creative.generations as unknown as {product_id:string;status:string;showcased_at:string|null};
  if(run.status!=="succeeded"||run.showcased_at)return {error:"This ad is still processing or is a public example. Create a new campaign version to revise it.",saved:false};
  const edits=copyEdits(creative.kind,form);
  if(!edits)return {error:"Add a caption (up to 2,000 characters), a short headline and a short button label.",saved:false};
  const version=JSON.stringify([creative.headline,creative.primary_text,creative.cta]);
  if(version!==form.get("version"))return {error:"This ad changed in another tab. Refresh before editing it again.",saved:false};
  let query=db.from("creatives").update(edits).eq("id",creative.id).eq("workspace_id",creative.workspace_id);
  for(const key of ["headline","primary_text","cta"] as const)query=creative[key]===null?query.is(key,null):query.eq(key,creative[key]);
  const {data:updated,error:saveError}=await query.select("id").maybeSingle();
  if(saveError||!updated)return {error:"We couldn’t save this edit. Refresh and try again.",saved:false};
  revalidatePath(`/dashboard/products/${run.product_id}`);
  revalidatePath("/dashboard/ads");
  return {error:null,saved:true};
}
