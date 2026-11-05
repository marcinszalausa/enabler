import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {customerRows,netCredits,overview,perDay,planLabel,runQuality,searchCustomers,type AdminData} from "../src/lib/admin-stats.ts";
const now=Date.parse("2026-11-04T12:00:00Z");
const data:AdminData={
 users:[{id:"u1",email:"old@shop.com",created_at:"2026-09-01T00:00:00Z",last_sign_in_at:null},{id:"u2",email:"New@Store.com",created_at:"2026-11-03T08:00:00Z",last_sign_in_at:"2026-11-04T01:00:00Z"}],
 workspaces:[{id:"w1",name:"Old",owner_id:"u1",plan:"free",credits:80,created_at:"2026-09-01T00:00:00Z"},{id:"w2",name:"Store",owner_id:"u2",plan:"plus",credits:500,created_at:"2026-11-03T08:00:00Z"}],
 generations:[
  {id:"g1",workspace_id:"w2",product_id:"p1",type:"image_ads",status:"succeeded",cost_credits:50,cost_usd:null,request_options:{quality:"best"},created_at:"2026-11-03T09:00:00Z"},
  {id:"g2",workspace_id:"w2",product_id:"p1",type:"video_ads",status:"failed",cost_credits:63,cost_usd:null,request_options:{quality:"better"},created_at:"2026-11-04T09:00:00Z"},
  {id:"g3",workspace_id:"w1",product_id:null,type:"image_ads",status:"succeeded",cost_credits:20,cost_usd:null,request_options:null,created_at:"2026-09-02T09:00:00Z"}],
 posts:[{id:"x",workspace_id:"w2",status:"published",created_at:"2026-11-04T10:00:00Z"},{id:"y",workspace_id:"w2",status:"failed",created_at:"2026-11-04T10:00:00Z"}],
 accounts:[{id:"a",workspace_id:"w2",platform:"tiktok"}],products:[{id:"p1",workspace_id:"w2"}],
 credits:[{workspace_id:"w2",charged:113,refunded:63},{workspace_id:"w1",charged:20,refunded:0}],credits30:[{workspace_id:"w2",charged:113,refunded:63}],
};
test("credits used are charges minus refunds of failed runs",()=>{assert.equal(netCredits({workspace_id:"w",charged:10,refunded:10}),0);assert.equal(netCredits(undefined),0);});
test("overview counts customers, paying plans, usage and cost",()=>{
 const o=overview(data,now);
 assert.equal(o.customers,2);assert.equal(o.new7,1);assert.equal(o.paying,1);assert.equal(o.monthlyPlanValue,69);
 assert.equal(o.credits30,50);assert.equal(o.creditsAll,70);assert.equal(o.estCost30,2.5);
 assert.equal(o.runs30,2);assert.equal(o.failed30,1);assert.equal(o.active30,1);assert.equal(o.published,1);assert.equal(o.failedPosts,1);
 assert.deepEqual(o.mix.find(m=>m.kind==="Video"),{kind:"Video",quality:"better",runs:1,failed:1,credits:0});
 assert.equal(o.signupsByDay.length,30);assert.equal(o.signupsByDay.at(-2)?.count,1);assert.equal(o.runsByDay.at(-1)?.count,1);
});
test("customer rows join owners and search by email, name, id and plan",()=>{
 const rows=customerRows(data);assert.equal(rows[0].email,"New@Store.com");assert.equal(rows[0].creditsUsed,50);assert.equal(rows[0].failedRuns,1);assert.equal(rows[0].posts,1);
 assert.equal(searchCustomers(rows,"new@store","").length,1);assert.equal(searchCustomers(rows,"","paid").length,1);assert.equal(searchCustomers(rows,"","free")[0].workspaceId,"w1");assert.equal(searchCustomers(rows,"w1","").length,1);
});
test("labels",()=>{assert.equal(planLabel("plus"),"Grow");assert.equal(planLabel(null),"Free");assert.equal(runQuality({quality:"x"}),"not set");assert.equal(perDay([now],now,3)[2].count,1);});
test("admin pages check access on the server before reading data",async()=>{
 for(const f of ["src/app/[locale]/dashboard/admin/page.tsx","src/app/[locale]/dashboard/admin/customers/[id]/page.tsx"]){const s=await readFile(f,"utf8");const load=Math.min(...["loadAdminData(","loadCustomer("].map(x=>s.indexOf(x)).filter(i=>i>0));assert.ok(s.indexOf("await requireAdmin()")>0&&s.indexOf("await requireAdmin()")<load,f);assert.ok(!s.includes('"use client"'));}
 const lib=await readFile("src/lib/admin.ts","utf8");assert.ok(lib.startsWith('import "server-only"'));assert.match(lib,/is_platform_admin/);
 const sql=await readFile("supabase/migrations/20261104170000_platform_admins.sql","utf8");assert.match(sql,/revoke all on function public\.is_platform_admin\(uuid\) from public, anon, authenticated/);assert.match(sql,/revoke all on function public\.admin_credit_totals\(timestamptz\) from public, anon, authenticated/);
});
import {parseCreditGrant} from "../src/lib/admin-stats.ts";
test("credit grants accept whole non-zero amounts for a real workspace id",()=>{
 const ws="00000000-0000-4000-8000-000000000000";
 assert.deepEqual(parseCreditGrant(ws,"100"," Refund "),{workspaceId:ws,amount:100,note:"Refund"});
 assert.equal((parseCreditGrant(ws,"-50",null) as {amount:number}).amount,-50);
 for(const bad of ["0","1.5","abc","","1e3","200000"])assert.ok("error" in parseCreditGrant(ws,bad,""),bad);
 assert.ok("error" in parseCreditGrant("w1","10",""));
});
test("grant SQL checks the admin inside the database and is service-role only",async()=>{
 const sql=await readFile("supabase/migrations/20261104180000_admin_credit_grants.sql","utf8");
 assert.match(sql,/if not public\.is_platform_admin\(admin\)/);
 assert.match(sql,/revoke all on function public\.admin_grant_credits\(uuid, uuid, integer, text\) from public, anon, authenticated/);
 const action=await readFile("src/app/[locale]/dashboard/admin/customers/[id]/actions.ts","utf8");
 assert.ok(action.indexOf("isPlatformAdmin(admin.id)")<action.indexOf('rpc("admin_grant_credits"'));
});
