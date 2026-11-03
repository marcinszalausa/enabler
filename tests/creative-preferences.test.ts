import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import ts from "typescript";
import {z} from "zod";
import {parseCreativePreferences,preferenceForm,withCreativePreferences,creativeDirection} from "../src/lib/creative-preferences.ts";
const prefs={promotion:"offer" as const,audience:"Dog owners who take daily walks",focus:"Comfortable everyday walks",offer:"Free shipping this week"};
test("preferences validate, trim and discard irrelevant offers",()=>{
 assert.deepEqual(parseCreativePreferences({...prefs,audience:"  Dog owners  "}),{...prefs,audience:"Dog owners"});
 assert.equal(parseCreativePreferences({...prefs,offer:""}),null);
 assert.equal(parseCreativePreferences({...prefs,focus:"x".repeat(241)}),null);
 assert.equal(parseCreativePreferences({...prefs,promotion:"unknown"}),null);
 assert.equal(parseCreativePreferences({...prefs,audience:" "}),null);
 assert.deepEqual(parseCreativePreferences({...prefs,promotion:"product"}),{...prefs,promotion:"product",offer:""});
 const form=new FormData();for(const [k,v] of Object.entries(prefs))form.set(k,v);
 assert.deepEqual(preferenceForm(form),prefs);
});
test("a batch snapshot wins over later product preference edits",()=>{
 const original={audience:"Original page audience",price:"29",benefits:["A real benefit"],creative_preferences:{...prefs,audience:"Edited later"},requires_personalization:true,preferences_confirmed_at:"2026-01-01"};
 const result=withCreativePreferences(original,prefs);
 assert.equal(result.audience,prefs.audience);assert.equal(result.price,"29");assert.deepEqual(result.benefits,original.benefits);
 assert.equal(original.audience,"Original page audience");
 assert.equal(result.requires_personalization,undefined);assert.equal(result.preferences_confirmed_at,undefined);
 assert.equal(withCreativePreferences(original,null).creative_preferences,undefined);
 assert.equal(withCreativePreferences(original,null).audience,"Original page audience");
 assert.match(creativeDirection(prefs),/Do not add discounts/);
});
function compile(source:string,names:string[],values:unknown[],result:string){
 const clean=source.replace(/^import ["'][^"']+["'];\r?$/gm,"").replace(/^import[\s\S]*?from\s+["'][^"']+["'];\r?$/gm,"").replace(/\bexport /g,"");
 const js=ts.transpileModule(clean,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 return new Function(...names,js+";return "+result)(...values);
}
test("both real model request builders receive the saved creative direction",async()=>{
 const calls:Record<string,unknown>[]=[];
 class FakeAnthropic { beta={messages:{parse:async(request:Record<string,unknown>)=>{calls.push(request);return {stop_reason:"end_turn",parsed_output:{ads:[{headline:"Test",shots:[{},{}]}]}};}}}; }
 const source=await readFile("src/lib/ai/claude.ts","utf8");
 const writers=compile(source,["Anthropic","betaZodOutputFormat","z","ACCENTS","ENERGIES","GENDERS","LANGUAGES","PEOPLE","isEnglish","verifyPublicUrl","UserError","creativeDirection"],
  [FakeAnthropic,()=>({}),z,{american:{label:"American"}},{upbeat:{direction:"upbeat"}},{female:{label:"Female"}},{english:{label:"English",script:"latin"}},{auto:{direction:null}},()=>true,()=>{throw Error("Unexpected network");},Error,creativeDirection],"{writeAdAngles,writeVideoAds}");
 const brief=withCreativePreferences({audience:"Page audience",product_name:"Walking set",price:"29"},prefs);
 await writers.writeAdAngles(brief,1,"english");
 await writers.writeVideoAds(brief,1,[4,3],{language:"english",gender:"female",accent:"american",energy:"upbeat",person:"auto",message:""});
 assert.equal(calls.length,2);
 for(const call of calls){
  const body=JSON.stringify(call.messages);
  for(const value of [prefs.audience,prefs.focus,prefs.offer,"Owner creative preferences"])assert.ok(body.includes(value),value);
 }
});
test("saving preferences is editor/workspace checked and generation uses an immutable snapshot",async()=>{
 let canEdit=true;let product:any={id:"product",workspace_id:"workspace",brand_brief:{audience:"Page audience",benefits:["Real benefit"],requires_personalization:true}};
 const writes:any[]=[],reservations:any[]=[],pending:(()=>unknown)[]=[],workers:any[]=[];
 const db={auth:{getUser:async()=>({data:{user:{id:"owner"}}})},from:(table:string)=>{
  const filters:Record<string,unknown>={};let update:any;
  const query:any={select:()=>query,order:()=>query,limit:()=>query,eq:(key:string,value:unknown)=>{filters[key]=value;return query;},
   single:async()=>({data:table==="workspaces"?{id:"workspace"}:product}),
   maybeSingle:async()=>{
    if(table!=="products"||filters.id!==product.id||filters.workspace_id!==product.workspace_id)return {data:null};
    if(update){product={...product,...update};writes.push(update);return {data:{id:product.id}};}
    return {data:product};
   },update:(value:unknown)=>{update=value;return query;}};
  return query;
 }};
 const messages={personal:{invalid:"invalid",couldntSave:"save failed",confirmFirst:"confirm first"},app:{errors:{notFound:"not found",couldntStart:"failed",noCredits:"credits"}}};
 const source=await readFile("src/app/[locale]/dashboard/actions.ts","utf8");
 const actions=compile(source,["redirect","after","revalidatePath","createClient","createAdminClient","scrapePage","extractBrandBrief","GENERATION_COST","runGeneration","runVideoGeneration","parseVideoOptions","videoRunCost","DEFAULT_LANGUAGE","isLanguageKey","userMessage","seedBrandKit","requestMessages","fmt","canEditWorkspace","WORKSPACE_WRITE_DENIED","parseCreativePreferences","preferenceForm"],
  [(path:string)=>{throw Error(path);},(cb:()=>unknown)=>pending.push(cb),()=>{},async()=>db,()=>({rpc:async(_name:string,args:unknown)=>{reservations.push(args);return {data:"batch"};}}),()=>{throw Error("Unexpected scrape");},()=>{throw Error("Unexpected model");},10,(job:unknown)=>workers.push(job),(job:unknown)=>workers.push(job),()=>null,()=>40,"english",()=>true,()=>"",()=>{},async()=>messages,(s:string)=>s,async()=>canEdit,"editor required",parseCreativePreferences,preferenceForm],"{saveCreativePreferences,startGeneration}");
 const form=new FormData();for(const [k,v] of Object.entries(prefs))form.set(k,v);form.set("productId","product");
 canEdit=false;assert.equal((await actions.saveCreativePreferences({error:null,saved:false},form)).saved,false);assert.equal(writes.length,0);
 canEdit=true;product.workspace_id="other";assert.equal((await actions.saveCreativePreferences({error:null,saved:false},form)).saved,false);assert.equal(writes.length,0);
 product.workspace_id="workspace";
 const run=new FormData();run.set("productId","product");run.set("requestId","10000000-0000-4000-8000-000000000001");run.set("language","english");
 assert.equal((await actions.startGeneration({error:null},run)).error,"confirm first");assert.equal(reservations.length,0);
 assert.equal((await actions.saveCreativePreferences({error:null,saved:false},form)).saved,true);
 assert.deepEqual(product.brand_brief.creative_preferences,prefs);assert.equal(product.brand_brief.audience,"Page audience");assert.deepEqual(product.brand_brief.benefits,["Real benefit"]);
 assert.equal((await actions.startGeneration({error:null},run)).error,null);
 product.brand_brief.creative_preferences.audience="Changed after start";
 await pending[0]();
 assert.equal(workers[0].creativePreferences.audience,prefs.audience);
 assert.equal(reservations[0].options.creative_preferences.audience,prefs.audience);
});
