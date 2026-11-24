import { mkdirSync, writeFileSync } from "node:fs";
import { pages, htmlDoc } from "../public/ui/shell.js";
mkdirSync("public/demo", { recursive: true });
for (const page of Object.keys(pages)) {
  const file = (page === "inicio" ? "index" : page) + ".html";
  writeFileSync("public/" + file, htmlDoc(page));
  writeFileSync("public/demo/" + file, htmlDoc(page, true));
}
