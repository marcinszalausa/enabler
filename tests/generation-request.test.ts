import test from "node:test";
import assert from "node:assert/strict";
import { GenerationRequest } from "../src/lib/generation-request.ts";

const token = "10000000-0000-4000-8000-000000000001";
function form(language = "english", id = token) {
  const data = new FormData();
  data.set("requestId", id);
  data.set("productId", "product");
  data.set("language", language);
  return data;
}
test("retries and queued double-clicks retain the captured operation ID", () => {
  const requests = new GenerationRequest();
  const original = form();
  assert.equal(requests.forForm(original), token);
  const nextToken = crypto.randomUUID();
  assert.equal(requests.forForm(form("english", nextToken)), nextToken);
  // An old submission can execute after a newer success rotated the form ID.
  assert.equal(requests.forForm(original), token);
});
test("changed input gets a different operation; its retry stays stable", () => {
  const requests = new GenerationRequest();
  requests.forForm(form());
  const changed = requests.forForm(form("polish"));
  assert.notEqual(changed, token);
  assert.equal(requests.forForm(form("polish")), changed);
});
test("framework metadata and field order do not create a new operation", () => {
  const requests = new GenerationRequest();
  requests.forForm(form());
  const reordered = new FormData();
  reordered.set("language", "english");
  reordered.set("productId", "product");
  reordered.set("requestId", token);
  reordered.set("$ACTION_ID_example", "framework");
  assert.equal(requests.forForm(reordered), token);
});
