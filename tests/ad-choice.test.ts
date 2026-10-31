import assert from "node:assert/strict";
import test from "node:test";
import {AD_CHOICE_KEY,adChoicePath,parseAdChoice,rememberAdChoice,readAdChoice,clearAdChoice} from "../src/lib/ad-choice.ts";
const choice={workspaceId:"81000000-0000-4000-8000-000000000001",productId:"81000000-0000-4000-8000-000000000002",generationId:"81000000-0000-4000-8000-000000000003",creativeId:"81000000-0000-4000-8000-000000000004"};
test("selection navigation is scoped, bounded and cannot become an external redirect",()=>{
 const now=Date.now(),raw=JSON.stringify({...choice,savedAt:now});
 assert.deepEqual(parseAdChoice(raw,choice.workspaceId,now),{...choice,savedAt:now});
 assert.equal(parseAdChoice(raw,"different-workspace",now),null);
 for(const patch of [{savedAt:now-86400001},{savedAt:now+1},{savedAt:"today"},{productId:"//evil.example"},{creativeId:"<script>"}]){
  assert.equal(parseAdChoice(JSON.stringify({...choice,savedAt:now,...patch}),choice.workspaceId,now),null);
 }
 assert.equal(parseAdChoice("{"),null);
 const path=adChoicePath({...choice,savedAt:now});
 assert.equal(new URL(path,"https://gooidy.com").origin,"https://gooidy.com");
 assert.equal(new URL(path,"https://gooidy.com").searchParams.get("favorite"),choice.creativeId);
});
test("chosen ad survives connection navigation and clears only for its own submission",()=>{
 const entries=new Map<string,string>();
 const storage={getItem:(k:string)=>entries.get(k)??null,setItem:(k:string,v:string)=>{entries.set(k,v);},removeItem:(k:string)=>{entries.delete(k);}};
 rememberAdChoice(storage,choice);assert.equal(readAdChoice(storage,choice.workspaceId)?.creativeId,choice.creativeId);
 clearAdChoice(storage,choice.generationId,"different");assert.equal(entries.has(AD_CHOICE_KEY),true);
 clearAdChoice(storage,choice.generationId,choice.creativeId);assert.equal(entries.has(AD_CHOICE_KEY),false);
 const blocked={getItem:()=>{throw new Error("blocked");},setItem:()=>{throw new Error("blocked");},removeItem:()=>{throw new Error("blocked");}};
 assert.equal(readAdChoice(blocked,choice.workspaceId),null);assert.doesNotThrow(()=>rememberAdChoice(blocked,choice));assert.doesNotThrow(()=>clearAdChoice(blocked,choice.generationId,choice.creativeId));
});
