import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderSite } from "./site-source.mjs";

const root = process.cwd();
const dist = resolve(root, "dist");
const server = resolve(dist, "server");
const html = await renderSite(root);
const ogPath = resolve(root, "public", "og.png");
const presenceCoverPath = resolve(root, "public", "in-presence-cover.jpg");
const taxSimulatorPath = resolve(root, "public", "inheritance-tax-simulator.html");
let ogBase64 = "";
let presenceCoverBase64 = "";
let taxSimulatorHtml = "";

try {
  ogBase64 = (await readFile(ogPath)).toString("base64");
} catch {
  ogBase64 = "";
}

try {
  presenceCoverBase64 = (await readFile(presenceCoverPath)).toString("base64");
} catch {
  presenceCoverBase64 = "";
}

try {
  taxSimulatorHtml = await readFile(taxSimulatorPath, "utf8");
} catch {
  taxSimulatorHtml = "";
}

const worker = `
const html = ${JSON.stringify(html)};
const ogBase64 = ${JSON.stringify(ogBase64)};
const presenceCoverBase64 = ${JSON.stringify(presenceCoverBase64)};
const taxSimulatorHtml = ${JSON.stringify(taxSimulatorHtml)};
const headers = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "public, max-age=300",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin"
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/og.png" && ogBase64) {
      const bytes = Uint8Array.from(atob(ogBase64), c => c.charCodeAt(0));
      return new Response(bytes, {
        headers: {
          "content-type": "image/png",
          "cache-control": "public, max-age=86400"
        }
      });
    }
    if (url.pathname === "/in-presence-cover.jpg" && presenceCoverBase64) {
      const bytes = Uint8Array.from(atob(presenceCoverBase64), c => c.charCodeAt(0));
      return new Response(bytes, {
        headers: {
          "content-type": "image/jpeg",
          "cache-control": "public, max-age=86400"
        }
      });
    }
    if (url.pathname === "/inheritance-tax-simulator.html" && taxSimulatorHtml) {
      return new Response(taxSimulatorHtml, {
        headers: {
          ...headers,
          "cache-control": "public, max-age=3600"
        }
      });
    }
    if (url.pathname !== "/" && url.pathname !== "/index.html") {
      return new Response("Not found", { status: 404 });
    }
    return new Response(html, { headers });
  }
};
`;

await mkdir(server, { recursive: true });
await mkdir(resolve(dist, ".openai"), { recursive: true });
await mkdir(resolve(dist, "static"), { recursive: true });
await writeFile(resolve(server, "index.js"), worker.trimStart(), "utf8");
await cp(
  resolve(root, ".openai", "hosting.json"),
  resolve(dist, ".openai", "hosting.json")
);
await cp(
  resolve(root, "public", "hkust-course-planner"),
  resolve(dist, "static", "hkust-course-planner"),
  { recursive: true }
);
console.log("Built bubbleTking's Playground");
