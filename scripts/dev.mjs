import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderSite } from "./site-source.mjs";

const port = Number(process.env.PORT || 3000);
const root = process.cwd();

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${port}`);
  const assets = new Map([
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
