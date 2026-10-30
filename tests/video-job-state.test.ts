import test from "node:test";
import assert from "node:assert/strict";
import { transitionVideoJob } from "../src/lib/video-job-state.ts";
type Db = Parameters<typeof transitionVideoJob>[0];
function fixture() {
  const row={id:"job",status:"pending",updated_at:"2026-01-01T00:00:00.000Z"};
  let fail=false;
  const db={from:()=>{
    let patch:Record<string,unknown>={}; const filters:Record<string,unknown>={};
    const q={
      update(value:Record<string,unknown>){patch=value;return q;},
      eq(key:string,value:unknown){filters[key]=value;return q;},
      async select(){
        if(fail) return {data:null,error:new Error("database unavailable")};
        if(Object.entries(filters).some(([k,v])=>row[k as keyof typeof row]!==v)) return {data:[],error:null};
        Object.assign(row,patch);return {data:[{id:row.id}],error:null};
      },
    };return q;
  }} as unknown as Db;
  return {row,db,breakDatabase:()=>{fail=true;}};
}
test("only one concurrent observer can claim a pending video",async()=>{
  const {row,db}=fixture();const a={...row},b={...row};
  const claims=await Promise.all([transitionVideoJob(db,a,{status:"processing"}),transitionVideoJob(db,b,{status:"processing"})]);
  assert.deepEqual(claims,[true,false]);assert.equal(row.status,"processing");
  assert.notEqual(a.updated_at,b.updated_at);
});
test("stale poller cannot fail a newer processing worker or its completed output",async()=>{
  const {row,db}=fixture();const stale={...row},worker={...row};
  assert.equal(await transitionVideoJob(db,worker,{status:"processing"}),true);
  assert.equal(await transitionVideoJob(db,stale,{status:"failed"}),false);
  assert.equal(await transitionVideoJob(db,worker,{status:"done"}),true);
  assert.equal(await transitionVideoJob(db,stale,{status:"failed"}),false);
  assert.equal(row.status,"done");
});
test("reclaimed processing token fences the previous worker",async()=>{
  const {row,db}=fixture();row.status="processing";
  const previous={...row},replacement={...row};
  assert.equal(await transitionVideoJob(db,replacement,{status:"processing"}),true);
  assert.equal(await transitionVideoJob(db,previous,{status:"failed"}),false);
  assert.equal(await transitionVideoJob(db,previous,{status:"done"}),false);
  assert.equal(await transitionVideoJob(db,replacement,{status:"done"}),true);
});
test("database errors propagate without changing local ownership",async()=>{
  const {row,db,breakDatabase}=fixture();const job={...row};breakDatabase();
  await assert.rejects(transitionVideoJob(db,job,{status:"processing"}),/database unavailable/);
  assert.deepEqual(job,row);
});
test("terminal jobs cannot transition again",async()=>{
  const {db}=fixture();
  for(const status of ["done","failed"]) assert.equal(await transitionVideoJob(db,{id:"job",status,updated_at:"2026-01-01T00:00:00Z"},{status:"processing"}),false);
});
