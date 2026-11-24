import { isPractice } from "./routing.js";
import { esc, icon, sidebar, toolbar, href, empty } from "./shell.js";
export { esc, icon, href, empty };
export const $ = (s, base = document) => base.querySelector(s);
export const state = {
  page: document.body.dataset.page,
  u: null,
  posts: [],
  filter: "Todos",
  tab: "",
  ticket: null,
};
export const params = new URLSearchParams(location.search);
export const formData = (f) => Object.fromEntries(new FormData(f));
export async function api(action, data, method) {
  if (isPractice) {
    const { practiceApi } = await import("./practice.js");
    return practiceApi(action, data, method);
  }
  const query = new URLSearchParams({ action });
  let options = { credentials: "same-origin", cache: "no-store" };
  if (method === "GET" || data === undefined) {
    for (const [k, v] of Object.entries(data || {})) query.set(k, v);
  } else {
    options.method = "POST";
    if (data instanceof FormData) options.body = data;
    else {
      options.headers = { "Content-Type": "application/json" };
      options.body = JSON.stringify(data);
    }
  }
  const r = await fetch("/api/pawtect?" + query, options);
  let v;
  try {
    v = await r.json();
  } catch {
    throw new Error("El servicio no respondió. Vuelve a cargar la página.");
  }
  if (!r.ok) throw new Error(v.error || "No se completó la operación.");
  return v;
}
export function chrome(u = state.u) {
  $("#sidebar").innerHTML = sidebar(state.page, u);
  $("#topbar").innerHTML = toolbar(state.page, u);
  const role = document.querySelector("#practice-role");
  if (role)
    role.textContent =
      {
        estudiante: "Estudiante",
        plantel: "Convivencia",
        psicologia: "Psicología",
        equipo: "Protección Pawtect",
        admin: "Administración",
      }[u.role] || "Datos ficticios";
}
export const body = (html) => {
  $("#page").innerHTML = html;
};
export function toast(s) {
  const t = $("#toast");
  t.textContent = s;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 4400);
}
export function dialog(title, html) {
  const d = $("#dialog");
  $("#dialog-content").innerHTML =
    '<div class="dialog-head"><h2>' +
    esc(title) +
    '</h2><button class="icon-btn" aria-label="Cerrar" data-act="close">' +
    icon("X") +
    "</button></div>" +
    html;
  if (!d.open) d.showModal();
}
export const close = () => $("#dialog").close();
export const opts = (list, selected) =>
  list
    .map((v) => {
      const [val, title] = Array.isArray(v) ? v : [v, v];
      return (
        '<option value="' +
        esc(val) +
        '" ' +
        (val === selected ? "selected" : "") +
        ">" +
        esc(title) +
        "</option>"
      );
    })
    .join("");
export const field = (label, name, extra = "") =>
  '<label class="field">' +
  esc(label) +
  '<input name="' +
  name +
  '" ' +
  extra +
  "></label>";
export const select = (label, name, list, value = "") =>
  '<label class="field">' +
  esc(label) +
  '<select name="' +
  name +
  '" required>' +
  opts(list, value) +
  "</select></label>";
export const area = (label, name, extra = "") =>
  '<label class="field">' +
  esc(label) +
  '<textarea name="' +
  name +
  '" ' +
  extra +
  "></textarea></label>";
export const check = (name, text, req = false) =>
  '<label class="check"><input type="checkbox" name="' +
  name +
  '" ' +
  (req ? "required" : "") +
  "><span>" +
  text +
  "</span></label>";
export const btn = (label, ico = "Check") =>
  '<button class="btn brand-btn" type="submit">' +
  icon(ico, 17) +
  esc(label) +
  "</button>";
export const abtn = (
  act,
  label,
  ico = "Plus",
  val = "",
  kind = "outline-btn",
) =>
  '<button class="' +
  kind +
  '" type="button" data-act="' +
  act +
  '" data-val="' +
  esc(val) +
  '">' +
  icon(ico, 17) +
  esc(label) +
  "</button>";
export const linkBtn = (url, label, ico = "PawPrint", cls = "btn brand-btn") =>
  '<a class="' +
  cls +
  '" href="' +
  esc(url) +
  '">' +
  icon(ico, 17) +
  esc(label) +
  "</a>";
export const feedback = '<p class="feedback" role="alert"></p>';
export const notice = (txt, ico = "ShieldCheck", tone = "") =>
  '<div class="notice-box ' +
  tone +
  '">' +
  icon(ico, 18) +
  "<div>" +
  txt +
  "</div></div>";
export const demoNotice = () =>
  state.u.demo
    ? notice(
        "Usa datos y archivos inventados. Lo que hagas en esta práctica se guarda solo en esta pestaña.",
        "Info",
      )
    : "";
export function bindForm(selector, fn) {
  const f = $(selector);
  if (!f) return;
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    if (f.dataset.busy) return;
    f.dataset.busy = "1";
    const submit = f.querySelector("button[type=submit]"),
      msg = f.querySelector(".feedback");
    if (submit) submit.disabled = true;
    if (msg) msg.textContent = "";
    try {
      await fn(formData(f), f);
    } catch (e) {
      if (msg) msg.textContent = e.message;
      else toast(e.message);
    } finally {
      delete f.dataset.busy;
      if (submit) submit.disabled = false;
    }
  };
}
export const stamp = (ts) =>
  new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Lima",
  }).format(new Date(Number(ts) * 1000));
export const pill = (s, c = "violet") =>
  '<span class="pill ' + c + '">' + esc(s) + "</span>";
export const prio = (s) =>
  pill(s, { Urgente: "urgent", Alta: "high", Normal: "normal" }[s]);
export function download(name, content, mime = "text/plain;charset=utf-8") {
  const u = URL.createObjectURL(
    content instanceof Blob ? content : new Blob([content], { type: mime }),
  );
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
}
export function actionForm(id, inner) {
  return '<form id="' + id + '" class="stack">' + inner + feedback + "</form>";
}
export function pageFail(msg) {
  body(
    empty("No pudimos abrir este espacio", msg, "Info") +
      '<div class="btn-row pad-top">' +
      abtn("reload", "Volver a intentar", "Compass") +
      linkBtn(
        "/login.html",
        "Ir a mi cuenta",
        "CircleUserRound",
        "outline-btn",
      ) +
      "</div>",
  );
}
