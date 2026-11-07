import sharp from "sharp";
import {createHash,randomUUID} from "node:crypto";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {photoReviewItem} from "@/lib/catalog/photo-access";
import {catalogBody} from "@/lib/catalog/security";
export const maxDuration=60;
const reply=(code:string,status:number)=>Response.json({code},{status,headers:{"Cache-Control":"private, no-store"}});
export async function POST(request:Request){
 if(request.headers.get("origin")!==new URL(request.url).origin)return reply("ACCESS_DENIED",403);
 const client=await createClient(),id=new URL(request.url).searchParams.get("itemId")??"";
 const item=await photoReviewItem(client,id);if(!item)return reply("ACCESS_DENIED",403);
 try{
  const raw=await catalogBody(request,4*1024*1024),form=await new Response(raw,{headers:{"Content-Type":request.headers.get("content-type")??""}}).formData();
  const file=form.get("photo");if(!(file instanceof File)||file.size<1||file.size>6*1024*1024||form.get("rightsConfirmed")!=="true")return reply("PHOTO_INVALID",400);
  const image=sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:32000000,animated:false}),meta=await image.metadata();
  if(!["jpeg","png","webp","avif","heif"].includes(meta.format??"")||(meta.pages??1)>1||!meta.width||!meta.height||Math.min(meta.width,meta.height)<768)return reply("PHOTO_TOO_SMALL_OR_INVALID",400);
  const bytes=await image.rotate().resize(1600,1600,{fit:"inside",withoutEnlargement:true}).jpeg({quality:95}).toBuffer();const normalized=await sharp(bytes).metadata();
  const current=await photoReviewItem(client,id);if(!current||current.image_revision!==item.image_revision)return reply("PHOTOS_CHANGED",409);
  const {data:{user}}=await client.auth.getUser();if(!user)return reply("ACCESS_DENIED",403);
  const db=createAdminClient(),path=item.workspace_id+"/"+item.id+"/"+randomUUID()+".jpg";
  const {data:registered,error}=await db.rpc("register_catalog_training_photo",{ws:item.workspace_id,item:item.id,path,hash:createHash("sha256").update(bytes).digest("hex"),width:normalized.width,height:normalized.height,actor:user.id});
  if(error){return reply(error.message.includes("PHOTO_LIMIT")?"PHOTO_LIMIT":"UPLOAD_FAILED",error.message.includes("PHOTO_LIMIT")?409:503);}
  // Reserve a bounded, content-addressed row before writing storage. Replaying
  // an interrupted upload repairs the same object rather than adding orphans.
  const {error:upload}=await db.storage.from("catalog-photos").upload(registered.storage_path,new Uint8Array(bytes),{contentType:"image/jpeg",upsert:true});if(upload)return reply("UPLOAD_FAILED",503);
  return Response.json({saved:true},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return reply("PHOTO_INVALID",400);}
}
