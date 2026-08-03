import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderSite } from "./site-source.mjs";

const root = process.cwd();
const output = resolve(root, "dist", "pages");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(root, "public"), output, { recursive: true });
await writeFile(resolve(output, "index.html"), await renderSite(root), "utf8");
await writeFile(resolve(output, ".nojekyll"), "", "utf8");

console.log("Built GitHub Pages site");
