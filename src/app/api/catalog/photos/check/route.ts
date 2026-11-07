import {createClient} from "@/lib/supabase/server";
import {catalogBody} from "@/lib/catalog/security";
import {photoReviewItem,validCatalogId,PhotoCheckBudget} from "@/lib/catalog/photo-access";
import {scanCatalogPhotos} from "@/lib/catalog/photo-check";
export const maxDuration=60;
const budget=new PhotoCheckBudget();
const reply=(code:string,status:number)=>Response.json({code},{status,headers:{"Cache-Control":"private, no-store",...(status===429?{"Retry-After":"60"}:{})}});
export async function POST(request:Request){
 if(request.headers.get("origin")!==new URL(request.url).origin)return reply("ACCESS_DENIED",403);
 if(!request.headers.get("content-type")?.startsWith("application/json"))return reply("INVALID_REQUEST",415);
 let id:unknown,includeUploads=false;try{const body=JSON.parse(new TextDecoder().decode(await catalogBody(request,4096)));id=body.itemId;includeUploads=body.includeUploads===true;}catch{return reply("INVALID_REQUEST",400);}
 if(!validCatalogId(id))return reply("INVALID_REQUEST",400);
 const db=await createClient();
 let item;try{item=await photoReviewItem(db,id);}catch{return reply("CHECK_UNAVAILABLE",503);}
 if(!item)return reply("ACCESS_DENIED",403);
 if(!budget.take(item.workspace_id))return reply("CHECK_BUSY",429);
 try{
  const images=includeUploads?(await (await import("@/lib/catalog/training-photos")).trainingPhotos(item)).map(p=>p.url):item.images;
  const {report}=await scanCatalogPhotos(images);
  // A sync, disconnect or downgrade while checking invalidates the report.
  const current=await photoReviewItem(db,id);
  if(!current)return reply("ACCESS_DENIED",403);
  if(current.image_revision!==item.image_revision||current.workspace_id!==item.workspace_id||current.connection_id!==item.connection_id)return reply("PHOTOS_CHANGED",409);
  return Response.json({report},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return reply("CHECK_UNAVAILABLE",503);}
 finally{budget.release();}
}
