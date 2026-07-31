import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolve } from "node:path";
import { renderSite } from "../scripts/site-source.mjs";

test("renders the project shelf and interactive demo", async () => {
  const html = await renderSite(resolve(import.meta.dirname, ".."));
  assert.match(html, /bubbleTking's Playground/);
  assert.match(html, /Hearing Guardian/);
  assert.match(html, /In Presence/);
  assert.match(html, /Enter the case/);
  assert.match(html, /Interactive demo/);
  assert.doesNotMatch(html, /__CSS__|__JS__/);
});

test("build emits a Sites worker", async () => {
  const worker = await readFile(
    resolve(import.meta.dirname, "..", "dist", "server", "index.js"),
    "utf8"
  );
  assert.match(worker, /export default/);
  assert.match(worker, /new Response/);
});
