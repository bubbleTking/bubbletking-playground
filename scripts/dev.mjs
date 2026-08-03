import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderSite } from "./site-source.mjs";

const port = Number(process.env.PORT || 3000);
const root = process.cwd();
const plannerAssets = new Map([
  ["/hkust-course-planner/", ["index.html", "text/html; charset=utf-8"]],
  ["/hkust-course-planner/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/hkust-course-planner/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/hkust-course-planner/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/hkust-course-planner/data/terms-data.js", ["data/terms-data.js", "text/javascript; charset=utf-8"]],
  ["/hkust-course-planner/data/ustspace-ratings-data.js", ["data/ustspace-ratings-data.js", "text/javascript; charset=utf-8"]],
  ["/hkust-course-planner/data/courses-2520.js", ["data/courses-2520.js", "text/javascript; charset=utf-8"]],
  ["/hkust-course-planner/data/courses-2530.js", ["data/courses-2530.js", "text/javascript; charset=utf-8"]],
  ["/hkust-course-planner/data/courses-2540.js", ["data/courses-2540.js", "text/javascript; charset=utf-8"]],
  ["/hkust-course-planner/data/courses-2610.js", ["data/courses-2610.js", "text/javascript; charset=utf-8"]],
]);

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${port}`);
  if (plannerAssets.has(url.pathname)) {
    const [fileName, contentType] = plannerAssets.get(url.pathname);
    try {
      const file = await readFile(resolve(root, "public", "hkust-course-planner", fileName));
      response.writeHead(200, { "content-type": contentType, "cache-control": "no-store" });
      response.end(file);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
    return;
  }
  const assets = new Map([
    ["/og.png", ["og.png", "image/png"]],
    ["/og.jpg", ["og.jpg", "image/jpeg"]],
    ["/in-presence-cover.jpg", ["in-presence-cover.jpg", "image/jpeg"]],
  ]);
  if (assets.has(url.pathname)) {
    const [fileName, contentType] = assets.get(url.pathname);
    try {
      const image = await readFile(resolve(root, "public", fileName));
      response.writeHead(200, { "content-type": contentType });
      response.end(image);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
    return;
  }
  if (url.pathname === "/inheritance-tax-simulator.html") {
    try {
      const simulator = await readFile(
        resolve(root, "public", "inheritance-tax-simulator.html"),
        "utf8"
      );
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      });
      response.end(simulator);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
    return;
  }
  if (url.pathname !== "/" && url.pathname !== "/index.html") {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  const html = await renderSite(root);
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(html);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Local: http://127.0.0.1:${port}`);
});
