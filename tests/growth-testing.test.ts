import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import ts from "typescript";
import {growthTests,growthTestingBrief} from "../src/lib/growth-testing.ts";
import {planTools,type ReportRow} from "../src/lib/plan-value.ts";
import {PAID_PLANS} from "../src/lib/paid-plans.ts";
const row=(patch:Partial<ReportRow>={}):ReportRow=>({id:"one",network:"Facebook",caption:"Your real product",date:"2026-11-01",state:"ready",impressions:1000,clicks:20,views:null,...patch});
test("testing ideas use distinct comparable posts with usable metrics",()=>{const tests=growthTests([row(),row({id:"two",impressions:500,clicks:15}),row({id:"instagram",network:"Instagram",clicks:90})]);assert.equal(tests.length,1);assert.equal(tests[0].source.id,"two");assert.equal(tests[0].reference.id,"one");assert.equal(tests[0].sourceRate,3);assert.equal(tests[0].referenceRate,2);});
test("missing, pending, small, inconsistent and identical data never invents an idea",()=>{for(const patch of [{state:"pending"},{state:"unavailable"},{impressions:null},{clicks:null},{impressions:499},{impressions:0},{clicks:-1},{clicks:1001},{impressions:NaN},{clicks:Infinity},{network:""}])assert.deepEqual(growthTests([row(),row({id:"two",...patch})]),[]);assert.deepEqual(growthTests([row(),row({id:"two"})]),[]);assert.deepEqual(growthTests([row(),row({clicks:90})]),[]);});
test("up to three test ideas remain separated by network or network combination",()=>{const rows=["Facebook","Instagram","YouTube","Facebook + Instagram"].flatMap((network,i)=>[row({id:"a"+i,network,impressions:1000+i*500}),row({id:"b"+i,network,impressions:1000+i*500,clicks:100})]);const tests=growthTests(rows);assert.equal(tests.length,3);for(const t of tests){assert.equal(t.source.network,t.reference.network);assert.notEqual(t.source.id,t.reference.id);}assert.equal(tests[0].network,"Facebook + Instagram");});
test("downloadable brief preserves evidence, limits and generation-cost disclosure",()=>{const tests=growthTests([row({caption:"<script>text only</script>"}),row({id:"two",clicks:50})]);const text=growthTestingBrief(tests,"2026-11-04T15:00:00Z");assert.match(text,/NEXT-CAMPAIGN TESTING BRIEF/);assert.match(text,/5.00%/);assert.match(text,/not controlled A\/B tests/);assert.match(text,/credit price shown before generation/);assert.match(text,/<script>text only<\/script>/);assert.ok(!text.includes("undefined"));});
test("Growth value-per-credit claim follows the actual catalogue",()=>{const growth=PAID_PLANS.find(p=>p.id==="growth")!;assert.equal(growth.price/growth.credits,Math.min(...PAID_PLANS.map(p=>p.price/p.credits)));});
function compileResults(source:string,dependencies:Record<string,unknown>){
 const clean=source.replace(/^import[\s\S]*?;\r?$/gm,"").replace(/\bexport /g,"");
 const js=ts.transpileModule(clean,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None,jsx:ts.JsxEmit.React}}).outputText;
 return new Function(...Object.keys(dependencies),js+";return Results")(...Object.values(dependencies));
}
test("actual insights page uses workspace plan, never a query parameter, to expose Growth",async()=>{
 let plan="free";const limits:number[]=[];
 const db={from:(table:string)=>{const q:any={select:()=>q,eq:()=>q,in:()=>q,order:()=>q,limit:(n:number)=>{if(table==="posts"){limits.push(n);return Promise.resolve({data:[],error:null});}return q;},single:async()=>({data:{id:"workspace",plan}})};return q;}};
 const React={Fragment:"Fragment",createElement:(type:unknown,props:unknown,...children:unknown[])=>({type,props,children})};
 const results=compileResults(await readFile("src/app/[locale]/dashboard/insights/page.tsx","utf8"),{React,planTools,createClient:async()=>db,getCurrentUser:async()=>({id:"user"}),GrowthReport:"GrowthReport",GrowthActionPlan:"GrowthActionPlan",Link:"Link"});
 const contains=(node:any):boolean=>!!node&&typeof node==="object"&&(node.type==="GrowthActionPlan"||(node.children??[]).flat(Infinity).some(contains));
 for(const value of ["free","starter","plus","growth"]){plan=value;const tree=await results({searchParams:Promise.resolve({load:"1",plan:"growth"}),locale:"en"});assert.equal(contains(tree),value==="growth");}
 assert.deepEqual(limits,[8,8,16,30]);
});
