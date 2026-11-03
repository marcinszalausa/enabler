import sharp from "sharp";
import {mkdir,writeFile,readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url),ffmpeg=require("ffmpeg-static");
const selected=[{"id":"a48dc2a0-0f50-41b8-b193-8538286ec600","aspect":"1:1"},{"id":"250c3780-9d5c-42d7-a8e5-1d780d632d0b","aspect":"1:1"},{"id":"833044a9-ccec-4b91-ac7a-fa297b4ce6d3","aspect":"1:1"},{"id":"2329b173-edbd-4f2b-93ad-f7b18c6e04dd","aspect":"1:1"},{"id":"45b0071f-cfd7-48d5-bf4a-5cb4e8eec558","aspect":"9:16"},{"id":"6219e1e5-5564-4d9c-b129-6d6adcc7164c","aspect":"9:16"},{"id":"c9d45f6e-a74e-4f03-9515-412c68f1b5ae","aspect":"9:16"},{"id":"31320abe-446a-4027-bd8f-a038e6984aee","aspect":"1:1"},{"id":"4d8bf40f-6e73-4210-a15c-aeef992d8495","aspect":"9:16"},{"id":"410e625a-3c30-487d-a7cd-93cbd19d77e0","aspect":"1:1"},{"id":"44358942-fd36-43bc-8f85-bf7e7c83becf","aspect":"9:16"},{"id":"0ffe0686-297c-4acb-8165-50f7a91ba99e","aspect":"1:1"},{"id":"b92d62b1-bdb8-4783-bbfa-4ad05eeae68d","aspect":"9:16"},{"id":"fda8a351-1913-49f2-89b9-9df884840d8b","aspect":"1:1"},{"id":"ed5b7474-c9b9-45fe-8c1a-411a39118bf8","aspect":"9:16"}];
const videoId="453cb5db-5f27-4289-9749-306e23b98cf4",sourcePhoto="https://cdn.shopify.com/s/files/1/0728/5941/8742/files/soft-mila-modal-wrap-cardigan-sage.jpg?v=1792808675&width=1200";
const manifest={version:1,images:{},videos:{},photos:{}},files=[];
await mkdir("/tmp/home-assets",{recursive:true});
async function publish(bytes,stem,width){
 const hash=createHash("sha256").update(bytes).digest("hex").slice(0,12),name=stem+"-"+hash+(width?"-"+width:"")+(width?".webp":".mp4");
 files.push({name,bytes});return "/showcase/"+name;
}
async function makeImage(source,stem){
 const normalized=sharp(source).rotate(),meta=await normalized.metadata();
 const full=await normalized.clone().resize({width:960,withoutEnlargement:true}).webp({quality:78,effort:6}).toBuffer();
 const small=await normalized.clone().resize({width:480,withoutEnlargement:true}).webp({quality:76,effort:6}).toBuffer();
 const tiny=await normalized.clone().resize({width:64,withoutEnlargement:true}).webp({quality:38}).toBuffer(),out=await sharp(full).metadata();
 return {src:await publish(full,stem,960),small:await publish(small,stem,480),width:out.width,height:out.height,placeholder:"data:image/webp;base64,"+tiny.toString("base64"),originalWidth:meta.width,originalHeight:meta.height};
}
let cursor=0;await Promise.all(Array.from({length:3},async()=>{while(cursor<selected.length){const item=selected[cursor++],r=await fetch("https://gooidy.com/api/creatives/"+item.id+"/image?layout=face-aware-v2",{signal:AbortSignal.timeout(45000)});if(!r.ok)throw new Error("Public image unavailable "+item.id+" "+r.status);manifest.images[item.id]=await makeImage(Buffer.from(await r.arrayBuffer()),"ad-"+item.id);}}));
const u=new URL(sourcePhoto);if(u.protocol!=="https:"||u.hostname!=="cdn.shopify.com")throw new Error("Unexpected source photo host");
const photoResponse=await fetch(sourcePhoto,{signal:AbortSignal.timeout(30000)});if(!photoResponse.ok)throw new Error("Source photo unavailable");
manifest.photos[sourcePhoto]=await makeImage(Buffer.from(await photoResponse.arrayBuffer()),"source-cardigan");
const vr=await fetch("https://gooidy.com/api/creatives/"+videoId+"/video",{signal:AbortSignal.timeout(45000)});if(!vr.ok)throw new Error("Video unavailable");
await writeFile("/tmp/home-assets/source.mp4",Buffer.from(await vr.arrayBuffer()));
execFileSync(ffmpeg,["-y","-i","/tmp/home-assets/source.mp4","-vf","scale=720:1280:force_original_aspect_ratio=decrease","-c:v","libx264","-crf","25","-preset","slow","-threads","2","-pix_fmt","yuv420p","-c:a","aac","-b:a","96k","-movflags","+faststart","/tmp/home-assets/walk.mp4"],{stdio:"ignore",timeout:120000});
const clip=await readFile("/tmp/home-assets/walk.mp4");if(clip.length>1800000)throw new Error("Video exceeds delivery budget "+clip.length);
execFileSync(ffmpeg,["-y","-ss","0.1","-i","/tmp/home-assets/walk.mp4","-frames:v","1","/tmp/home-assets/poster.png"],{stdio:"ignore"});
const poster=await makeImage(await readFile("/tmp/home-assets/poster.png"),"poster-walk");
manifest.videos[videoId]={src:await publish(clip,"walk",0),poster:poster.src,bytes:clip.length};
manifest.posters={[poster.src]:poster};
for(const file of files){
 const data=file.bytes.toString("base64");for(let i=0;i<data.length;i+=24000)console.log("MEDIA_BYTES",file.name,i/24000,data.slice(i,i+24000));
}
console.log("ASSET_MANIFEST",Buffer.from(JSON.stringify(manifest)).toString("base64"));
console.log("ASSET_SIZES",JSON.stringify(files.map(f=>({name:f.name,bytes:f.bytes.length}))));
console.log("SOURCE_PHOTO_REVIEW",(await sharp(await readFile("/tmp/home-assets/poster.png")).resize(240).jpeg().toBuffer()).toString("base64"));
