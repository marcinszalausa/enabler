import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mkdtemp,readFile,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFileSync} from "node:child_process";
import sharp from "sharp";
const require=createRequire(import.meta.url),{build}=createRequire("/tmp/media-quality/package.json")("esbuild");
const names={
 "server-only":[],
 "@/lib/ai/claude":["reviewAdImage","reviewAdVideo","writeAdAngles","writeVideoAds"],
 "@/lib/ai/fal":["generateAdImage","generateLibraryImage","generateMusic","generateVoiceover","getAdVideo","submitAdVideo"],
 "@/lib/public-fetch":["fetchPublicUrl","verifyPublicUrl"],
 "@/lib/supabase/admin":["createAdminClient"],
 "@/lib/social/publish":["autopilotRun"],
 "@/lib/brand-kit":["getBrandKit"],
 "@/lib/brand":["loadFont","textColorOn"],
 "@/lib/video-job-state":["transitionVideoJob"],
 "@/lib/video-edit":["editVideoAd"]
};
async function bundle(file,append=""){
 const result=await build({entryPoints:[file],bundle:true,platform:"node",format:"cjs",packages:"external",write:false,plugins:[{
  name:"offline-quality-fixture",
  setup(b){
   b.onResolve({filter:/^(server-only|@\/lib\/(?:ai\/claude|ai\/fal|public-fetch|supabase\/admin|social\/publish|brand-kit|brand|video-job-state|video-edit))$/},args=>({path:args.path,namespace:"quality-mock"}));
   b.onLoad({filter:/.*/,namespace:"quality-mock"},args=>({contents:(names[args.path]??[]).map(n=>'export const '+n+'=(...args)=>globalThis.__qualityMocks.'+n+'(...args);').join("\n")+(args.path==="@/lib/brand"?'\nexport const FONTS={inter:{name:"Inter"}};export const DEFAULT_BRAND_KIT={logo_path:null,accent_color:"#ffffff",font:"inter"};':""),loader:"js"}));
   if(append)b.onLoad({filter:/src\/lib\/video\.tsx$/},async args=>({contents:(await readFile(args.path,"utf8"))+"\n"+append,loader:"tsx"}));
  }
 }]});
 const module={exports:{}};new Function("require","module","exports",result.outputFiles[0].text)(require,module,module.exports);return module.exports;
}
const dir=await mkdtemp(join(tmpdir(),"quality-integration-")),originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{throw Error("Unexpected network request");};
try{
 const photo=await sharp(await readFile("public/reels/softmila-still.jpg")).resize(1024,1024,{fit:"cover"}).jpeg().toBuffer();
 let generated=[],reviews=[],mode="outage",corrupt=false,uploads=0,edits=0,done=0,videoReviews=0;
 let clip;
 const db={
  storage:{from:()=>({download:async()=>({data:new Blob([Buffer.from("fixture")]),error:null}),upload:async()=>{uploads++;return {error:null};}})},
  from:table=>table==="products"?{
   select(){return this;},eq(){return this;},abortSignal(){return this;},
   async single(){return {data:{name:"Fixture product",brand_brief:{product_name:"Fixture product"},image_urls:["https://example.com/original.jpg"]},error:null};}
  }:table==="generations"?{
   select(){return this;},eq(){return this;},
   async maybeSingle(){return {data:{request_options:{}},error:null};}
  }:{async upsert(){uploads++;return {error:null};}}
 };
 globalThis.__qualityMocks={
  generateAdImage:async opts=>{generated.push(opts);return "https://example.com/candidate-"+generated.length+".jpg";},
  reviewAdImage:async opts=>{reviews.push(opts);if(mode==="outage")throw Error("review offline");const ok=mode==="approve"||reviews.length>1;return {ok,issues:ok?"":"Product changed color"};},
  fetchPublicUrl:async url=>({status:200,body:url.endsWith(".mp4")?clip:corrupt?Buffer.from("broken"):photo}),
  verifyPublicUrl:async url=>new URL(url),
  createAdminClient:()=>db,
  getBrandKit:async()=>({font:"inter",accent_color:"#7364ff",logo_path:null}),
  loadFont:async()=>Buffer.from("fixture font"),textColorOn:()=>"white",
  reviewAdVideo:async opts=>{videoReviews++;assert.equal(opts.frames.length,6);assert.equal(opts.referenceImageUrl,"https://example.com/original.jpg");return {ok:mode==="approve",issues:mode==="approve"?"":"Product morphs"};},
  editVideoAd:async()=>{edits++;return Buffer.from("editor fixture");},
  transitionVideoJob:async()=>{done++;return true;},
  autopilotRun:async()=>{throw Error("Publishing forbidden");}
 };
 const pipeline=await bundle("src/lib/pipeline.ts");
 const input={prompt:"Full product photo",aspect:"1:1",quality:"best",referenceImageUrl:"https://example.com/scene.jpg",productReferenceImageUrl:"https://example.com/original.jpg",sameScene:true,product:"Fixture product"};
 await assert.rejects(pipeline.generateCheckedImage(input),e=>e.constructor.name==="QualityReviewUnavailableError");
 assert.equal(generated.length,1);assert.equal(reviews.length,2);assert.equal(uploads,0);
 generated=[];reviews=[];mode="retry";
 assert.equal(await pipeline.generateCheckedImage(input),"https://example.com/candidate-2.jpg");
 assert.equal(generated[1].retry,true);assert.equal(generated[1].avoid,"Product changed color");
 assert.equal(reviews[0].referenceImageUrl,input.productReferenceImageUrl);assert.equal(reviews[0].continuityImageUrl,input.referenceImageUrl);
 generated=[];reviews=[];mode="approve";
 await pipeline.generateCheckedImage({...input,productReferenceImageUrl:null});assert.equal(reviews[0].referenceImageUrl,null);
 corrupt=true;generated=[];reviews=[];
 await assert.rejects(pipeline.generateCheckedImage(input),e=>e.constructor.name==="QualityError");
 assert.equal(generated.length,3);assert.equal(reviews.length,0);corrupt=false;
 console.log("PASS actual image pipeline rejects reviewer outages, retains original reference and bounds retries");
 execFileSync(require("ffmpeg-static"),["-y","-f","lavfi","-i","testsrc2=size=720x1280:rate=24:duration=4","-c:v","libx264","-preset","ultrafast","-threads","2",join(dir,"clip.mp4")],{stdio:"ignore",timeout:30000});
 clip=await readFile(join(dir,"clip.mp4"));
 const video=await bundle("src/lib/video.tsx","export {saveVideo as testSaveVideo};");
 const job={id:"fixture-job",voice_path:"voice",music_path:"music",headline:"Fixture",cta:"Shop now",voiceover:"Fixture narration",primary_text:"Fixture",angle:"benefit"};
 mode="reject";uploads=0;edits=0;done=0;
 await assert.rejects(video.testSaveVideo("workspace","generation","product",job,["https://example.com/one.mp4","https://example.com/two.mp4"]),e=>e.constructor.name==="QualityError");
 assert.equal(videoReviews,1);assert.equal(edits,0);assert.equal(uploads,0);assert.equal(done,0);
 mode="approve";
 await video.testSaveVideo("workspace","generation","product",job,["https://example.com/one.mp4","https://example.com/two.mp4"]);
 assert.equal(edits,1);assert.equal(uploads,2);assert.equal(done,1);
 console.log("PASS actual video delivery requires review before editing, storage or completion");
}finally{globalThis.fetch=originalFetch;delete globalThis.__qualityMocks;await rm(dir,{recursive:true,force:true});}
