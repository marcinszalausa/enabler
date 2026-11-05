import test from "node:test";
import assert from "node:assert/strict";
import {blockedBy,deleteAd,deleteProduct,runFolder,type DeleteDeps} from "../src/lib/deletion.ts";

// A tiny stand-in for the Supabase query builder that records every call.
type Call={table:string;op:string;filters:[string,string,unknown][];values?:unknown};
function fakeDb(rows:Record<string,unknown>,calls:Call[],storage:{removed:string[][];folders:Record<string,{name:string;id:string|null}[]>}){
 const from=(table:string)=>{const call:Call={table,op:"select",filters:[]};
  const q:Record<string,unknown>={};
  const done=()=>{calls.push(call);const data=rows[table+":"+call.op]??rows[table];return Promise.resolve({data,error:null});};
  Object.assign(q,{select:()=>q,delete:()=>{call.op="delete";return q;},update:(v:unknown)=>{call.op="update";call.values=v;return q;},
   eq:(c:string,v:unknown)=>{call.filters.push(["eq",c,v]);return q;},in:(c:string,v:unknown)=>{call.filters.push(["in",c,v]);return q;},
   maybeSingle:done,then:(ok:(v:unknown)=>unknown,bad:(e:unknown)=>unknown)=>done().then(ok,bad)});
  return q;};
 return {from,storage:{from:()=>({list:async(folder:string)=>({data:storage.folders[folder]??[],error:null}),remove:async(paths:string[])=>{storage.removed.push(paths);return {error:null};}})}} as never;
}
const WS="11111111-1111-1111-1111-111111111111";
test("runs still being made or shown on the public site keep their ads",()=>{
 assert.equal(blockedBy([{status:"succeeded",showcased_at:null}]),null);
 assert.equal(blockedBy([{status:"running",showcased_at:null}]),"busy");
 assert.equal(blockedBy([{status:"queued",showcased_at:"x"}]),"busy");
 assert.equal(blockedBy([{status:"succeeded",showcased_at:"2026-11-01"}]),"showcased");
 assert.equal(runFolder(WS,"g1"),WS+"/g1");
});
test("deleting an ad cancels its queued post, removes the row and its own file only",async()=>{
 const calls:Call[]=[],storage={removed:[] as string[][],folders:{}},cancelled:string[]=[];
 const client=fakeDb({creatives:{id:"c1",workspace_id:WS,storage_path:WS+"/g1/1-1x1.jpg",generations:{status:"succeeded",showcased_at:null}}},calls,storage);
 const admin=fakeDb({posts:[{id:"p1",zernio_post_id:"z1"}]},calls,storage);
 const deps:DeleteDeps={client,admin,canEdit:async()=>true,cancelPost:async id=>{cancelled.push(id);}};
 assert.equal(await deleteAd(deps,"c1"),"ok");
 assert.deepEqual(cancelled,["z1"]);
 assert.ok(calls.some(c=>c.table==="posts"&&c.op==="update"&&(c.values as {status:string}).status==="cancelled"));
 const del=calls.find(c=>c.table==="creatives"&&c.op==="delete");
 assert.deepEqual(del?.filters,[["eq","id","c1"],["eq","workspace_id",WS]]);
 assert.deepEqual(storage.removed,[[WS+"/g1/1-1x1.jpg"]]);
 assert.ok(!calls.some(c=>c.table==="generations"),"usage history is never touched");
});
test("a failed post cancellation stops the delete",async()=>{
 const calls:Call[]=[],storage={removed:[] as string[][],folders:{}};
 const client=fakeDb({creatives:{id:"c1",workspace_id:WS,storage_path:WS+"/g1/a.jpg",generations:{status:"succeeded",showcased_at:null}}},calls,storage);
 const admin=fakeDb({posts:[{id:"p1",zernio_post_id:"z1"}]},calls,storage);
 const deps:DeleteDeps={client,admin,canEdit:async()=>true,cancelPost:async()=>{throw new Error("down");}};
 assert.equal(await deleteAd(deps,"c1"),"error");
 assert.ok(!calls.some(c=>c.op==="delete"));
 assert.deepEqual(storage.removed,[]);
});
test("viewers without edit access cannot delete",async()=>{
 const calls:Call[]=[],storage={removed:[] as string[][],folders:{}};
 const client=fakeDb({products:{id:"p",workspace_id:WS}},calls,storage);
 const deps:DeleteDeps={client,admin:client,canEdit:async()=>false,cancelPost:async()=>{}};
 assert.equal(await deleteProduct(deps,"p"),"missing");
 assert.ok(!calls.some(c=>c.op==="delete"));
});
test("deleting a product removes its ads, files and row but keeps its runs",async()=>{
 const calls:Call[]=[],storage={removed:[] as string[][],folders:{[WS+"/g1"]:[{name:"1-1x1.jpg",id:"f1"},{name:"shots",id:null}],[WS+"/g1/shots"]:[{name:"s1.mp4",id:"f2"}]}};
 const client=fakeDb({products:{id:"p",workspace_id:WS}},calls,storage);
 const admin=fakeDb({generations:[{id:"g1",status:"succeeded",showcased_at:null,creatives:[{id:"c1",storage_path:WS+"/g1/1-1x1.jpg"}]}],posts:[]},calls,storage);
 assert.equal(await deleteProduct({client,admin,canEdit:async()=>true,cancelPost:async()=>{}},"p"),"ok");
 assert.ok(calls.some(c=>c.table==="creatives"&&c.op==="delete"));
 assert.ok(calls.some(c=>c.table==="products"&&c.op==="delete"));
 assert.ok(!calls.some(c=>c.table==="generations"&&c.op!=="select"));
 assert.deepEqual(storage.removed.flat().sort(),[WS+"/g1/1-1x1.jpg",WS+"/g1/shots/s1.mp4"]);
});
test("a product with a run in progress is left as it is",async()=>{
 const calls:Call[]=[],storage={removed:[] as string[][],folders:{}};
 const client=fakeDb({products:{id:"p",workspace_id:WS}},calls,storage);
 const admin=fakeDb({generations:[{id:"g1",status:"running",showcased_at:null,creatives:[]}]},calls,storage);
 assert.equal(await deleteProduct({client,admin,canEdit:async()=>true,cancelPost:async()=>{}},"p"),"busy");
 assert.ok(!calls.some(c=>c.op==="delete"));
});
