import test from "node:test";
import assert from "node:assert/strict";
import {libraryFilter,libraryPath} from "../src/lib/ad-library.ts";
test("untrusted query values cannot produce invalid kinds or unbounded offsets",()=>{
 for(const page of ["-1","0","1e6","10000","NaN","1.5",["2"]])assert.equal(libraryFilter({page}).page,1);
 assert.deepEqual(libraryFilter({kind:["video"],favorites:["1"]}),{kind:"all",favorites:false,page:1});
 assert.deepEqual(libraryFilter({kind:"video",favorites:"1",page:"3"}),{kind:"video",favorites:true,page:3});
});
test("pagination preserves filters while default links stay clean",()=>{
 assert.equal(libraryPath({kind:"all",favorites:false,page:1}),"/dashboard/ads");
 assert.equal(libraryPath({kind:"image",favorites:true,page:2}),"/dashboard/ads?kind=image&favorites=1&page=2");
});
