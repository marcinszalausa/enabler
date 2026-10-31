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
