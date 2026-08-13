import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("production service worker precaches the hashed app shell and game art", async () => {
  const worker = await readFile("dist/client/sw.js", "utf8");
  assert.match(worker, /\/assets\/index-[^"']+\.js/);
  assert.match(worker, /\/assets\/index-[^"']+\.css/);
  assert.match(worker, /\/assets\/game\/counter-stage-toy\.png/);
  assert.match(worker, /\/assets\/game\/customer-anjie-consultation\.png/);
  assert.match(worker, /\/manifest\.webmanifest/);
  assert.match(worker, /noto-serif-sc-chinese-simplified-[^"']+\.woff2/);
  assert.doesNotMatch(worker, /fonts\.googleapis\.com/);
  assert.doesNotMatch(worker, /Promise\.reject/);
});
