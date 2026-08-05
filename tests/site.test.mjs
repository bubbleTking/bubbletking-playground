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
  assert.match(html, /Open full experience/);
  assert.match(html, /https:\/\/bucolic-eclair-b6f8f1\.netlify\.app\//);
  assert.doesNotMatch(html, /presence-dialog|Connect the evidence/);
  assert.match(html, /Excel Diff Studio/);
  assert.match(html, /https:\/\/excel-diff-studio\.netlify\.app\//);
  assert.match(html, /Open web app/);
  assert.match(html, /AI Status Watch/);
  assert.match(html, /https:\/\/github\.com\/bubbleTking\/ai-status-watch/);
  assert.match(html, /Inheritance Tax Simulator/);
  assert.match(html, /inheritance-tax-simulator\.html/);
  assert.match(html, /LearningPacer/);
  assert.match(html, /https:\/\/learningpacer\.org\//);
  assert.match(html, /Started Sep 2025/);
  assert.match(html, /HKUST Course Planner/);
  assert.match(html, /href="hkust-course-planner\/"/);
  assert.match(html, /Quota and waitlists/);
  assert.match(html, /07 live projects/);
  assert.match(html, /og\.png/);
  assert.ok(
    html.indexOf('<article class="presence-feature">') <
      html.indexOf('<article class="excel-feature">')
  );
  assert.ok(
    html.indexOf('<article class="excel-feature">') <
      html.indexOf('<article class="learning-feature">')
  );
  assert.ok(
    html.indexOf('<article class="learning-feature">') <
      html.indexOf('<section class="small-project-collection"')
  );
  assert.match(html, /Compact ideas, still useful/);
  assert.match(html, /Created 14 May 2026/);
  assert.match(html, /Created 24 May 2026/);
  assert.match(html, /Created 30 Jul 2026/);
  assert.match(html, /data-language="zh-CN"/);
  assert.match(html, /可以体验的作品/);
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
  assert.match(worker, /inheritance-tax-simulator\.html/);
  const planner = await readFile(
    resolve(import.meta.dirname, "..", "dist", "static", "hkust-course-planner", "index.html"),
    "utf8"
  );
  assert.match(planner, /HKUST Course Planner/);
  assert.match(planner, /Export class numbers/);
  assert.doesNotMatch(planner, /courses-data\.js/);
  const plannerApp = await readFile(
    resolve(import.meta.dirname, "..", "dist", "static", "hkust-course-planner", "app.js"),
    "utf8"
  );
  assert.match(plannerApp, /handleSelectedSectionChange/);
  assert.match(plannerApp, /class_number/);
  const terms = await readFile(
    resolve(import.meta.dirname, "..", "dist", "static", "hkust-course-planner", "data", "terms-data.js"),
    "utf8"
  );
  assert.match(terms, /2026-27 Fall/);
});
