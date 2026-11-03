import test from "node:test";
import assert from "node:assert/strict";
import { claimGeneration, finalizeGeneration } from "../src/lib/generation-credits.ts";

type Db = Parameters<typeof claimGeneration>[0];
test("claim errors are propagated before any worker can proceed", async () => {
  const failure = new Error("database unavailable");
  const chain = {
    update() { return this; }, eq() { return this; },
    async select() { return { data: null, error: failure }; },
  };
  await assert.rejects(claimGeneration({ from: () => chain } as unknown as Db, "run"), failure);
});
test("a lost claim or terminal generation does not start another worker", async () => {
  const chain = {
    update() { return this; }, eq() { return this; },
    async select() { return { data: [], error: null }; },
  };
  assert.equal(await claimGeneration({ from: () => chain } as unknown as Db, "run"), false);
});
test("a failed settlement can be retried with the identical operation", async () => {
  const calls: unknown[] = [];
  const failure = new Error("lost response");
  const db = { rpc: async (...args: unknown[]) => {
    calls.push(args);
    return calls.length === 1 ? { data: null, error: failure } : { data: false, error: null };
  } } as unknown as Db;
  await assert.rejects(finalizeGeneration(db, "run", "succeeded", 2, null), failure);
  assert.equal(await finalizeGeneration(db, "run", "succeeded", 2, null), false);
  assert.deepEqual(calls[0], calls[1]);
});
test("missing receipt is not reported as successful settlement", async () => {
  const db = { rpc: async () => ({ data: null, error: null }) } as unknown as Db;
  await assert.rejects(finalizeGeneration(db, "run", "failed", 10, "failure"), /Missing settlement receipt/);
});
