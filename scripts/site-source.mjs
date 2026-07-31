import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function renderSite(root = process.cwd()) {
  const source = resolve(root, "src");
  const [html, css, javascript] = await Promise.all([
    readFile(resolve(source, "index.html"), "utf8"),
    readFile(resolve(source, "styles.css"), "utf8"),
    readFile(resolve(source, "app.js"), "utf8"),
  ]);
  return html.replace("__CSS__", css).replace("__JS__", javascript);
}
