const pages = new Set([
  "inicio",
  "foro",
  "ayuda",
  "psicologia",
  "casos",
  "gestion",
  "login",
  "colegios",
  "guia",
  "normas",
]);
export const isPractice =
  typeof document !== "undefined" && document.body?.dataset.mode === "demo";
export function pageUrl(path, practice = isPractice) {
  if (!practice) return path;
  if (path === "/") return "/demo/index.html";
  const match = /^\/([a-z]+)\.html([?#].*)?$/.exec(path);
  return match && pages.has(match[1]) ? "/demo" + path : path;
}
export function scopeLinks(root) {
  if (!isPractice || !root.querySelectorAll) return;
  const links = root.matches?.("a[href]")
    ? [root]
    : root.querySelectorAll("a[href]");
  for (const a of links) {
    if (a.hasAttribute("data-absolute")) continue;
    const old = a.getAttribute("href"),
      next = pageUrl(old);
    if (next !== old) a.setAttribute("href", next);
  }
}
export const validNext = (value) =>
  pages.has(value) && !["login", "inicio"].includes(value)
    ? "/" + value + ".html"
    : null;
