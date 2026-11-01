const origin="https://gooidy.com";
const html=await(await fetch(origin)).text();
const clean=html.replaceAll("&amp;","&").replaceAll("%2F","/").replaceAll("%2f","/");
const ids=[...new Set([...clean.matchAll(/\/api\/creatives\/([0-9a-f-]{36})\/image/g)].map(m=>m[1]))];
console.log("PUBLIC_IDS",ids);
for(const id of ids){
 const path="/api/creatives/"+id+"/image?layout=face-aware-v2";
 for(const url of [origin+path,origin+"/_next/image?url="+encodeURIComponent(path)+"&w=640&q=75"]){
  const start=Date.now();try{const r=await fetch(url,{signal:AbortSignal.timeout(45000)});const b=Buffer.from(await r.arrayBuffer());console.log("IMAGE_PROBE",JSON.stringify({id,optimized:url.includes("/_next/"),status:r.status,type:r.headers.get("content-type"),bytes:b.length,ms:Date.now()-start,cache:r.headers.get("x-vercel-cache"),layout:r.headers.get("x-gooidy-layout-analysis"),error:r.ok?undefined:b.toString("utf8").slice(0,1000)}));}catch(e){console.log("IMAGE_PROBE_ERROR",id,String(e));}
 }
}
