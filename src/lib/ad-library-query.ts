import type {SupabaseClient} from "@supabase/supabase-js";
import {LIBRARY_PAGE_SIZE,type LibraryFilter,type LibraryAd} from "./ad-library";
// Must receive the user's authenticated client, never the service role.
export async function readAdLibrary(client:SupabaseClient,userId:string,filter:LibraryFilter){
 const favorites=filter.favorites?"creative_favorites!inner(user_id)":"creative_favorites(user_id)";
 let query=client.from("creatives").select(
  "id,workspace_id,generation_id,kind,aspect,headline,primary_text,created_at,"+
  "generations!inner(status,product_id,products!inner(id,name,url)),workspaces!inner(brand_kits(accent_color,font,logo_path)),"+favorites
 ).neq("status","rejected").in("generations.status",["succeeded","failed"])
  .eq("creative_favorites.user_id",userId)
  .order("created_at",{ascending:false}).order("id",{ascending:false});
 if(filter.kind!=="all")query=query.eq("kind",filter.kind);
 const offset=(filter.page-1)*LIBRARY_PAGE_SIZE;
 const {data,error}=await query.range(offset,offset+LIBRARY_PAGE_SIZE);
 if(error)throw new Error("Ad library query failed",{cause:error});
 type Row={id:string;workspace_id:string;generation_id:string;kind:"image"|"video";aspect:string;headline:string|null;primary_text:string|null;created_at:string;workspaces:{brand_kits:{accent_color:string;font:string;logo_path:string|null}|null};creative_favorites:{user_id:string}[];generations:{status:string;product_id:string;products:{id:string;name:string|null;url:string}}};
 const rows=(data??[]) as unknown as Row[];
 const ads:LibraryAd[]=rows.slice(0,LIBRARY_PAGE_SIZE).map(row=>({
  id:row.id,workspaceId:row.workspace_id,generationId:row.generation_id,
  productId:row.generations.products.id,productName:row.generations.products.name??row.generations.products.url,
  kind:row.kind,aspect:row.aspect,headline:row.headline,caption:row.primary_text,createdAt:row.created_at,
  favorite:row.creative_favorites.length>0,
  imageVersion:encodeURIComponent((row.workspaces.brand_kits?.accent_color??"#ffffff")+(row.workspaces.brand_kits?.font??"inter")+(row.workspaces.brand_kits?.logo_path??"")),
 }));
 return {ads,hasNext:rows.length>LIBRARY_PAGE_SIZE};
}
