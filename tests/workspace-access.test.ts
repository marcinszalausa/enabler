import test from "node:test";
import assert from "node:assert/strict";
import { canEditWorkspace } from "../src/lib/workspace-access.ts";
import { enforceConnectedAccountLimit } from "../src/lib/social/connection-limit.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

test("workspace writes require an explicit editor result from the user's RPC", async () => {
  for (const result of [{data:true,error:null},{data:false,error:null},{data:null,error:null},
    {data:true,error:{code:"08006"}},{data:"true",error:null}]) {
    const db={rpc:async(name:string,args:unknown)=>{
      assert.equal(name,"is_workspace_member");assert.deepEqual(args,{ws:"workspace-a",min_role:"editor"});
      return result;
    }} as unknown as SupabaseClient;
    assert.equal(await canEditWorkspace(db,"workspace-a"),result.data===true && !result.error);
  }
});

function setup(owner: string | null, ids: string[] = [], failure?: "lookup"|"plan"|"provider"|"delete") {
  const calls: string[]=[];
  const scopes: Record<string,string>[]=[];
  const db={from:(table:string)=>{
    assert.equal(table,"social_accounts");
    const filters:Record<string,string>={};scopes.push(filters);
    const chain={
      select(){calls.push("lookup");return this;},
      delete(){calls.push("delete");return this;},
      eq(key:string,value:string){filters[key]=value;return this;},
      async maybeSingle(){
        if(failure==="lookup")return {data:null,error:new Error("lookup failed")};
        // Omitting the workspace filter would return a foreign row and fail the test.
        return {data:owner && (!filters.workspace_id || filters.workspace_id===owner)?{id:"account"}:null,error:null};
      },
      then(resolve:(value:unknown)=>unknown,reject:(error:unknown)=>unknown){
        return Promise.resolve({error:failure==="delete"?new Error("delete failed"):null}).then(resolve,reject);
      },
    };
    return chain;
  }} as unknown as SupabaseClient;
  const deps={
    accountsInPlan:async(ws:string)=>{calls.push("plan");assert.equal(ws,"workspace-a");if(failure==="plan")throw new Error("plan failed");return {ids};},
    disconnect:async(id:string)=>{calls.push("provider");assert.equal(id,"account");if(failure==="provider")throw new Error("provider failed");},
  };
  return {db,deps,calls,scopes};
}
test("a forged callback account in another workspace never reaches provider deletion",async()=>{
  const s=setup("workspace-b");
  assert.equal(await enforceConnectedAccountLimit(s.db,"workspace-a","account",s.deps),"unowned");
  assert.deepEqual(s.calls,["lookup"]);
  assert.deepEqual(s.scopes[0],{id:"account",workspace_id:"workspace-a"});
});
test("a missing account never reaches plan or provider operations",async()=>{
  const s=setup(null);
  assert.equal(await enforceConnectedAccountLimit(s.db,"workspace-a","account",s.deps),"unowned");
  assert.deepEqual(s.calls,["lookup"]);
});
test("an owned account covered by the plan remains connected",async()=>{
  const s=setup("workspace-a",["account"]);
  assert.equal(await enforceConnectedAccountLimit(s.db,"workspace-a","account",s.deps),"allowed");
  assert.deepEqual(s.calls,["lookup","plan"]);
});
test("only a verified owned over-limit account is removed, with a scoped local delete",async()=>{
  const s=setup("workspace-a");
  assert.equal(await enforceConnectedAccountLimit(s.db,"workspace-a","account",s.deps),"removed");
  assert.deepEqual(s.calls,["lookup","plan","provider","delete"]);
  assert.deepEqual(s.scopes[1],{id:"account",workspace_id:"workspace-a"});
});
test("lookup/plan errors stop before provider calls; provider errors stop local deletion",async()=>{
  for(const failure of ["lookup","plan","provider","delete"] as const){
    const s=setup("workspace-a",[],failure);
    await assert.rejects(enforceConnectedAccountLimit(s.db,"workspace-a","account",s.deps),new RegExp(failure+" failed"));
    if(failure==="lookup"||failure==="plan")assert.equal(s.calls.includes("provider"),false);
    if(failure==="provider")assert.equal(s.calls.includes("delete"),false);
  }
});
