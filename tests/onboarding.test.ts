import test from "node:test";
import assert from "node:assert/strict";
import {productLink,safeNextPath,setupPath,setupContext,adKind} from "../src/lib/onboarding.ts";
import {PreviewBudget} from "../src/lib/onboarding-preview-limit.ts";
test("product links normalize without allowing script schemes or credentials",()=>{
 assert.equal(productLink("store.example/products/a#details"),"https://store.example/products/a");
 for(const value of ["javascript:alert(1)","data:text/html,test","https://user:secret@store.example","http://localhost",null,"x".repeat(2050)])assert.equal(productLink(value),null);
 assert.equal(adKind("unsupported"),"image");
});
test("product and format survive nested login and callback URLs",()=>{
 const url="https://store.example/products/a?variant=42&ref=home";
 const next=setupPath(url,"video");
 const login=new URL("https://gooidy.com/login");login.searchParams.set("next",next);
 const callback=new URL("https://gooidy.com/auth/callback");callback.searchParams.set("next",login.searchParams.get("next")!);
 assert.deepEqual(setupContext(callback.searchParams.get("next")),{url,kind:"video"});
 assert.equal(safeNextPath(next),next);
 assert.equal(setupContext("/dashboard"),null);
});
test("auth handoff rejects external and browser-normalized redirect attacks",()=>{
 for(const value of ["https://evil.example","//evil.example","/\\\\evil.example","/\n/evil.example","/login",null])assert.equal(safeNextPath(value),"/dashboard");
});
test("preview budget bounds one visitor and aggregate work and resets",()=>{
 const budget=new PreviewBudget();
 for(let i=0;i<6;i++)assert.equal(budget.take("one",100000),true);
 assert.equal(budget.take("one",100000),false);
 for(let i=0;i<34;i++)assert.equal(budget.take("other"+i,100000),true);
 assert.equal(budget.take("fresh",100000),false);
 assert.equal(budget.take("one",160001),true);
});

import { readFile } from "node:fs/promises";
import ts from "typescript";
async function routeFunction(path: string, name: string, names: string[], values: unknown[]) {
 const source=(await readFile(path,"utf8")).replace(/^import .*;\r?$/gm,"").replace("export async function "+name,"async function "+name);
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 return new Function(...names,js+";return "+name)(...values);
}
const response={next:()=>({}),rewrite:()=>({}),redirect:(url:URL)=>({redirect:url.toString()})};
test("session proxy preserves the selected destination for signed-in and signed-out visitors",async()=>{
 let signedIn=true;
 const update=await routeFunction("src/lib/supabase/proxy.ts","updateSession",
  ["NextResponse","createServerClient","supabaseUrl","supabasePublishableKey","safeNextPath"],
  [response,()=>({auth:{getClaims:async()=>({data:{claims:signedIn?{sub:"fixture"}:null}})}}),"https://example.supabase.co","fixture",safeNextPath]);
 const target=setupPath("https://store.example/products/a?variant=3","video");
 const req=(url:string)=>({url,nextUrl:Object.assign(new URL(url),{clone:()=>new URL(url)}),cookies:{getAll:()=>[],set:()=>{}}});
 assert.equal((await update(req("https://gooidy.com/login?"+new URLSearchParams({next:target})))).redirect,"https://gooidy.com"+target);
 assert.equal((await update(req("https://gooidy.com/login?next=%2F%2Fevil.example"))).redirect,"https://gooidy.com/dashboard");
 signedIn=false;
 const redirect=new URL((await update(req("https://gooidy.com"+target))).redirect);
 assert.equal(redirect.pathname,"/login");assert.equal(redirect.searchParams.get("next"),target);
});
test("successful and failed magic-link callbacks preserve a safe setup destination",async()=>{
 let error: unknown=null;
 const callback=await routeFunction("src/app/auth/callback/route.ts","GET",["NextResponse","createClient","safeNextPath"],
  [response,async()=>({auth:{exchangeCodeForSession:async()=>({error})}}),safeNextPath]);
 const target=setupPath("https://store.example/products/a","image");
 const url=new URL("https://gooidy.com/auth/callback");url.searchParams.set("code","fixture");url.searchParams.set("next",target);
 const request={nextUrl:url};
 assert.equal((await callback(request)).redirect,"https://gooidy.com"+target);
 error={message:"expired"};
 const failed=new URL((await callback(request)).redirect);
 assert.equal(failed.pathname,"/login");assert.equal(failed.searchParams.get("next"),target);assert.equal(failed.searchParams.get("error"),"link");
});
