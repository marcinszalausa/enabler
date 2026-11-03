import test from "node:test";
import assert from "node:assert/strict";
import { distinctProducts, heroProducts, productKey } from "../src/lib/product-display.ts";
const ad=(key:string,id=key)=>({productKey:key,id});
test("image/video and collection/query variants share a product identity",()=>{
  const key=productKey("https://WWW.shop.com/collections/sets/products/Cabin-Set/?variant=1#photo");
  assert.equal(key,productKey("http://shop.com/products/cabin-set?utm_source=video"));
  assert.notEqual(key,productKey("https://shop.com/products/other-set"));
  assert.notEqual(key,productKey("https://another-shop.com/products/cabin-set"));
});
test("zero, one and two products leave unfillable hero slots empty",()=>{
  assert.deepEqual(heroProducts([]),{feed:[],left:undefined,right:undefined});
  const one=heroProducts([ad("A","image"),ad("A","video")]);
  assert.equal(one.feed.length,2);assert.equal(one.left,undefined);assert.equal(one.right,undefined);
  const two=heroProducts([ad("A"),ad("B"),ad("A","other")]);
  assert.equal(two.left?.productKey,"B");assert.equal(two.right,undefined);
  assert.ok(two.feed.every(x=>x.productKey==="A"));
});
test("all hero frames remain distinct from both fixed neighbors, through multiple wraps",()=>{
  for(let products=3;products<=8;products++){
    const pool=Array.from({length:45},(_,i)=>ad(String(i%products),String(i)));
    const plan=heroProducts(pool);
    assert.notEqual(plan.left?.productKey,plan.right?.productKey);
    for(let frame=0;frame<plan.feed.length*4;frame++){
      const current=plan.feed[frame%plan.feed.length];
      assert.notEqual(current.productKey,plan.left?.productKey);
      assert.notEqual(current.productKey,plan.right?.productKey);
    }
    assert.ok(plan.feed.length<=6);
  }
});
test("an image-heavy product cannot fill several neighboring slots",()=>{
  const plan=heroProducts([...Array.from({length:100},(_,i)=>ad("A",String(i))),ad("B"),ad("C")]);
  assert.equal(plan.left?.productKey,"B");assert.equal(plan.right?.productKey,"C");
  assert.ok(plan.feed.every(x=>x.productKey==="A"));
});
test("showcase rows and placements select one creative per product",()=>{
  const row=distinctProducts([ad("A","video"),ad("A","image"),ad("B"),ad("C"),ad("B","other"),ad("")]);
  assert.deepEqual(row.map(x=>x.productKey),["A","B","C"]);
  const loop=[...row,...row];
  for(let i=1;i<loop.length;i++)assert.notEqual(loop[i-1].productKey,loop[i].productKey);
  assert.deepEqual(distinctProducts([ad("A"),ad("A","other")]).map(x=>x.productKey),["A"]);
});

test("fixed side previews prefer images without changing their product identity",()=>{
  const plan=heroProducts([
    {productKey:"A",video:true},
    {productKey:"B",video:true},
    {productKey:"C",video:true},
    {productKey:"B",image:"b.jpg"},
    {productKey:"C",image:"c.jpg"},
  ]);
  assert.equal(plan.left?.image,"b.jpg");assert.equal(plan.right?.image,"c.jpg");
  assert.ok(plan.feed.every(ad=>ad.productKey==="A"));
});
