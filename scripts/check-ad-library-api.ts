import assert from "node:assert/strict";
import {setTimeout as pause} from "node:timers/promises";
import {libraryTestClient,LIBRARY_TEST_USER} from "./library-fixture-client";
import {readAdLibrary} from "../src/lib/ad-library-query";
async function main(){
const client=libraryTestClient(),base={kind:"all" as const,favorites:false,page:1};
let ready=false;for(let i=0;i<40;i++){const {error}=await client.from("creatives").select("id").limit(1);if(!error){ready=true;break;}await pause(500);}assert.ok(ready,"Local PostgREST ready after schema reload");
const first=await readAdLibrary(client,LIBRARY_TEST_USER,base);
assert.equal(first.ads.length,24);assert.equal(first.hasNext,true);
assert.ok(first.ads.every(ad=>!ad.id.endsWith("000000000099")&&!ad.id.endsWith("000000000031")&&!ad.id.endsWith("000000000032")));
assert.ok(first.ads.some(ad=>ad.id.endsWith("000000000033")),"Saved partial output remains usable");
const brandBefore=first.ads[0].imageVersion;
const brandChange=await client.from("brand_kits").upsert({workspace_id:first.ads[0].workspaceId,accent_color:"#123456",font:"poppins"},{onConflict:"workspace_id"});assert.equal(brandChange.error,null);
const rebranded=await readAdLibrary(client,LIBRARY_TEST_USER,base);assert.notEqual(rebranded.ads[0].imageVersion,brandBefore,"Brand changes invalidate image preview URLs");
const next=await readAdLibrary(client,LIBRARY_TEST_USER,{...base,page:2});
assert.equal(next.ads.length,7);assert.equal(next.hasNext,false);
assert.equal(new Set([...first.ads,...next.ads].map(ad=>ad.id)).size,31);
const videos=await readAdLibrary(client,LIBRARY_TEST_USER,{...base,kind:"video"});
assert.equal(videos.ads.length,2);assert.ok(videos.ads.every(ad=>ad.kind==="video"));
const favorites=await readAdLibrary(client,LIBRARY_TEST_USER,{...base,favorites:true});
assert.equal(favorites.ads.length,2);assert.ok(favorites.ads.every(ad=>ad.favorite));
const viewerId="81000000-0000-4000-8000-000000000002",viewer=libraryTestClient(viewerId);
assert.equal((await readAdLibrary(viewer,viewerId,{...base,favorites:true})).ads.length,1);
assert.ok((await readAdLibrary(viewer,viewerId,base)).ads.every(ad=>!ad.favorite),"Another member's favorites stay private");
const foreignId="84000000-0000-4000-8000-000000000099";
const denied=await client.from("creative_favorites").insert({creative_id:foreignId,user_id:LIBRARY_TEST_USER});
assert.ok(denied.error,"REST cannot favorite another workspace");
console.log("PASS actual Supabase/PostgREST joins, pagination, filters, partial ads, viewer scope and private favorites");

}
main().catch(error=>{console.error(error);process.exitCode=1;});
