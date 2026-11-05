import assert from "node:assert/strict";
import test from "node:test";
import {
  addOnsFor, imageLanes, parsePriorityField, PRIORITY_IMAGE_LANES, priorityFor,
  priorityHelps, priorityScore, STANDARD_IMAGE_LANES,
} from "../src/lib/add-ons.ts";
import { IMAGE_CREDITS } from "../src/lib/quality.ts";

test("Priority is charged per image only when the owner asks and it helps", () => {
  assert.deepEqual(priorityFor({ requested: true, included: false, images: 10, video: false }),
    { priority: true, included: false, credits: 10 });
  assert.deepEqual(priorityFor({ requested: false, included: false, images: 10, video: false }),
    { priority: false, included: false, credits: 0 });
});

test("plan-included Priority is free and applies without asking", () => {
  assert.deepEqual(priorityFor({ requested: false, included: true, images: 6, video: false }),
    { priority: true, included: true, credits: 0 });
});

test("small runs and videos are never charged for Priority", () => {
  assert.equal(priorityHelps(STANDARD_IMAGE_LANES), false);
  assert.equal(priorityHelps(STANDARD_IMAGE_LANES + 1), true);
  for (const images of [1, 2, 3]) {
    assert.equal(priorityFor({ requested: true, included: true, images, video: false }).credits, 0);
    assert.equal(priorityFor({ requested: true, included: false, images, video: false }).priority, false);
  }
  assert.equal(priorityFor({ requested: true, included: false, images: 10, video: true }).priority, false);
});

test("a Priority run's cost stays a whole multiple of its images, so refunds stay exact", () => {
  for (const credits of Object.values(IMAGE_CREDITS)) {
    for (const images of [4, 5, 6, 10]) {
      const extra = priorityFor({ requested: true, included: false, images, video: false }).credits;
      assert.equal((images * credits + extra) % images, 0);
    }
  }
});

test("lanes, form field, stored add-ons and score", () => {
  assert.equal(imageLanes(true), PRIORITY_IMAGE_LANES);
  assert.equal(imageLanes(false), STANDARD_IMAGE_LANES);
  assert.ok(PRIORITY_IMAGE_LANES > STANDARD_IMAGE_LANES);
  assert.equal(parsePriorityField("on"), true);
  assert.equal(parsePriorityField(null), false);
  assert.equal(parsePriorityField("yes please"), false);
  assert.equal(addOnsFor({ priority: false, included: false, credits: 0 }), null);
  assert.deepEqual(addOnsFor({ priority: true, included: true, credits: 0 }), { priority: true, priority_included: true });
  assert.equal(priorityScore({ add_ons: { priority: true } }), 100);
  assert.equal(priorityScore({ add_ons: { priority: "true" } }), 0);
  assert.equal(priorityScore(null), 0);
});
