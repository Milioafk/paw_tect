import { pageUrl } from "./routing.js";
import { landing } from "./campus.js";
import { categories } from "./catalog.js";
export const pages = {
  inicio: "Inicio",
  foro: "Foro estudiantil",
  ayuda: "Pedir ayuda",
  casos: "Mis casos",
  psicologia: "Psicología",
  colegios: "Para colegios",
  normas: "Privacidad y normas",
  login: "Mi cuenta",
  gestion: "Gestión",
  guia: "Guía del proyecto",
};
export const href = (k) => (k === "inicio" ? "/" : "/" + k + ".html");
export const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const icon = (name, size = 20) =>
  '<svg class="ico" width="' +
  size +
  '" height="' +
  size +
  '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="/ui/icons.svg#' +
  name +
  '"></use></svg>';
export const avatar = (key = "menta", size = "") =>
  '<span aria-hidden="true" class="avatar ' +
  (Object.keys(avatarForms).includes(key) ? key : "menta") +
  " " +
  size +
  '">' +
  avatarForms[Object.keys(avatarForms).includes(key) ? key : "menta"] +
  "</span>";
const avatarForms = {
  menta: icon("Sprout", 24),
  luna: icon("MoonStar", 24),
  sol: icon("Sun", 23),
  nube: icon("CloudSun", 23),
  equipo: icon("ShieldCheck", 22),
};
export const initialUser = {
  role: "visitante",
  guest: true,
  demo: false,
  unread: 0,
};
const navEntries = (u) => [
  ["inicio", "Inicio"],
  ["foro", "Foro"],
  [
    u.guest || u.role === "estudiante" ? "casos" : "gestion",
    u.guest || u.role === "estudiante" ? "Mis casos" : "Mi panel",
  ],
  ["colegios", "Para colegios"],
];
function navigation(page, u) {
  return navEntries(u)
    .map(
      ([k, title]) =>
        "<a " +
        (page === k ? 'aria-current="page" ' : "") +
        'href="' +
        href(k) +
        '">' +
        title +
        "</a>",
    )
    .join("");
}
export function sidebar(page, u) {
  return (
    '<nav aria-label="Menú móvil">' +
    navigation(page, u) +
    '<a href="/psicologia.html">Psicología</a><a href="/normas.html">Privacidad</a><a href="/demo/index.html">Explorar la demo</a></nav>'
  );
}
export function toolbar(page, u) {
  return (
    '<div class="mast-inner"><a class="campus-brand" href="/" aria-label="Pawtect, inicio"><img src="/media/escudo.png" alt="" width="35" height="42"><span>PAWTECT</span></a><nav class="wide-nav" aria-label="Principal">' +
    navigation(page, u) +
    '</nav><div class="mast-tools"><a href="/demo/index.html" class="nav-demo">Demo</a><a class="quick-exit" href="/apuntes.html" data-act="quick" data-absolute>' +
    icon("LogOut", 16) +
    "<span>Salida rápida</span></a>" +
    (u.guest
      ? ""
      : '<button class="bell" data-act="notices" aria-label="Notificaciones">' +
        icon("Bell", 18) +
        (u.unread ? "<i></i>" : "") +
        "</button>") +
    '<a class="account-access" href="/login.html">' +
    icon("CircleUserRound", 17) +
    "<span>" +
    (u.guest ? "Ingresar" : "Mi cuenta") +
    '</span></a><button id="hamburger" class="nav-toggle" data-act="menu" aria-expanded="false" aria-controls="sidebar" aria-label="Abrir menú">' +
    icon("Menu", 22) +
    "</button></div></div>"
  );
}
export function shell(page, u, inside, practice = false) {
  return (
    '<a class="skip" href="#contenido">Saltar al contenido</a><div class="workspace"><header class="mast" id="topbar">' +
    toolbar(page, u) +
    '</header><div id="sidebar" class="phone-panel">' +
    sidebar(page, u) +
    "</div>" +
    (practice
      ? '<div class="practice-bar"><div><b>Práctica local</b><span id="practice-role">Datos ficticios</span><a href="/login.html">Cambiar rol</a><button data-act="resetDemo">Reiniciar</button><button data-act="leaveDemo">Salir de la demo</button></div></div>'
      : "") +
    '<main id="contenido" tabindex="-1"><div class="page" id="page">' +
    inside +
    '</div></main><footer class="foot campus-foot"><span><b>Pawtect.</b> Tu estilo, tus reglas, tu seguridad.</span><div><a href="/demo/index.html">Explorar la demo</a><a href="/normas.html">Privacidad</a><a href="/guia.html">Guía del proyecto</a></div></footer></div><dialog id="dialog"><div id="dialog-content"></div></dialog><div id="toast" role="status" aria-live="polite"></div>'
  );
}
export function support() {
  return (
    '<aside class="right-rail"><section class="support"><div class="rail-title"><span class="rail-dot">' +
    icon("HeartHandshake", 19) +
    "</span><h2>Tu red de apoyo</h2></div>" +
    [
      [
        "ayuda",
        "HandHeart",
        "Pedir ayuda privada",
        "Cuenta lo que te pasa.",
        "peach",
      ],
      [
        "psicologia",
        "Headphones",
        "Hablar con psicología",
        "Conversa en privado.",
        "violet",
      ],
      [
        "casos",
        "ClipboardList",
        "Seguir mi caso",
        "Revisa tus actualizaciones.",
        "mint",
      ],
    ]
      .map(
        ([p, i, t, s, c]) =>
          '<a class="support-link" href="' +
          href(p) +
          '"><span class="tile ' +
          c +
          '">' +
          icon(i, 22) +
          "</span><span><b>" +
          t +
          "</b><small>" +
          s +
          "</small></span></a>",
      )
      .join("") +
    '</section><section class="privacy-card"><div class="privacy-art" aria-hidden="true">' +
    icon("ShieldCheck", 101) +
    '</div><span class="privacy-icon">' +
    icon("LockKeyhole", 19) +
    '</span><h3>Tu privacidad importa</h3><p>En el foro, tus compañeros solo ven tu alias.</p><a href="/normas.html">Conocer las normas</a></section></aside>'
  );
}
export function ago(ts) {
  const delta = Math.max(0, Math.floor(Date.now() / 1000) - Number(ts));
  if (delta < 60) return "Ahora";
  if (delta < 3600) return "Hace " + Math.floor(delta / 60) + " min";
  if (delta < 86400) return "Hace " + Math.floor(delta / 3600) + " h";
  return "Hace " + Math.floor(delta / 86400) + " d";
}
export const tone = (c) =>
  ({ Experiencias: "violet", Consejos: "mint", Preguntas: "peach" })[c] ||
  "violet";
export function postCard(p) {
  return (
    '<article class="post" data-post="' +
    esc(p.id) +
    '"><div class="post-top">' +
    avatar(p.avatar) +
    '<div class="byline"><b>' +
    esc(p.alias) +
    "</b><small>" +
    ago(p.created) +
    '</small></div><span class="tag ' +
    tone(p.category) +
    '">' +
    esc(p.category) +
    '</span><button class="subtle-icon more" aria-label="Opciones de publicación" data-act="postMenu" data-id="' +
    esc(p.id) +
    '">' +
    icon("Ellipsis", 20) +
    "</button></div><h3>" +
    esc(p.title) +
    '</h3><p class="post-body">' +
    esc(p.body) +
    '</p><div class="post-actions"><button class="' +
    (Number(p.liked) ? "reacted" : "") +
    '" aria-pressed="' +
    !!Number(p.liked) +
    '" data-act="like" data-id="' +
    esc(p.id) +
    '" aria-label="Mostrar apoyo">' +
    icon("Heart", 18) +
    " <span>" +
    Number(p.hearts || 0) +
    '</span><span class="action-word"> apoyos</span></button><button data-act="comments" data-id="' +
    esc(p.id) +
    '">' +
    icon("MessageCircle", 17) +
    " <span>" +
    Number(p.comments || 0) +
    '</span><span class="action-word"> respuestas</span></button><button class="bookmark ' +
    (Number(p.saved) ? "reacted" : "") +
    '" data-act="save" data-id="' +
    esc(p.id) +
    '" aria-pressed="' +
    !!Number(p.saved) +
    '" aria-label="Guardar publicación">' +
    icon("Bookmark", 18) +
    '</button></div><div class="thread" hidden></div></article>'
  );
}
export function empty(title, body, ico = "MessagesSquare") {
  return (
    '<div class="empty"><span>' +
    icon(ico, 29) +
    "</span><h3>" +
    esc(title) +
    "</h3><p>" +
    esc(body) +
    "</p></div>"
  );
}
export function home(page, u, posts = [], filter = "Todos") {
  if (page === "inicio") return landing(u);
  const filtered = posts.filter(
    (p) =>
      filter === "Todos" ||
      (filter === "Guardados" && Number(p.saved)) ||
      p.category === filter,
  );
  return (
    '<div class="page-intro forum-intro"><div class="eyebrow">' +
    icon("MessagesSquare", 15) +
    " COMUNIDAD</div><h1>Foro estudiantil<span>.</span></h1><p>Un lugar para compartir experiencias con estudiantes de tu comunidad.</p></div>" +
    '<div class="community-grid"><section class="feed"><div class="feed-title"><div><h2>Conversaciones</h2></div>' +
    (u.role === "estudiante"
      ? '<button class="btn create-btn" data-act="compose">' +
        icon("SquarePen", 17) +
        " Publicar</button>"
      : "") +
    '</div><div class="filters" aria-label="Filtrar publicaciones">' +
    ["Todos", ...categories, "Guardados"]
      .map(
        (c) =>
          '<button class="filter ' +
          (filter === c ? "selected" : "") +
          '" aria-pressed="' +
          (filter === c) +
          '" data-act="filter" data-val="' +
          c +
          '">' +
          c +
          "</button>",
      )
      .join("") +
    '</div><div id="posts">' +
    (filtered.length
      ? filtered.map(postCard).join("")
      : empty(
          "Todavía no hay publicaciones",
          filter === "Guardados"
            ? "Guarda una conversación para volver a ella."
            : "Puedes iniciar la primera conversación de esta categoría.",
        )) +
    "</div>" +
    (u.demo
      ? '<p class="fine sample-note">Comunidad de demostración con publicaciones ficticias.</p>'
      : "") +
    "</section>" +
    support() +
    "</div>"
  );
}
export function intro(k, title, desc, i = "PawPrint") {
  return (
    '<header class="page-intro">' +
    (k ? '<div class="eyebrow">' + icon(i, 16) + " " + esc(k) + "</div>" : "") +
    "<h1>" +
    esc(title) +
    "<span>.</span></h1><p>" +
    esc(desc) +
    "</p></header>"
  );
}
export function startContent(page, u = initialUser) {
  if (page === "inicio") return landing(u);
  return (
    intro("PAWTECT", pages[page], "", "PawPrint") +
    '<div class="loading" role="status">Abriendo tu espacio…</div>'
  );
}
export function htmlDoc(page, practice = false) {
  const u = practice
    ? { role: "estudiante", alias: "Estudiante", demo: true }
    : initialUser;
  let inside = shell(page, u, startContent(page, u), practice);
  if (practice)
    inside = inside.replace(
      /href="(\/[^"]*)"/g,
      (_, url) => 'href="' + pageUrl(url, true) + '"',
    );
  return (
    '<!DOCTYPE html><html lang="es-PE"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="same-origin"><meta name="theme-color" content="#fbfaf7"><meta name="description" content="Pawtect, un espacio para hablar de lo que pasa en el cole y encontrar apoyo."><title>' +
    esc(pages[page]) +
    (practice ? " · Práctica" : "") +
    ' · Pawtect</title><link rel="icon" href="/media/escudo.png"><link rel="preload" href="/fonts/bricolage-grotesque.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/ui/style.css"><link rel="stylesheet" href="/ui/campus.css"></head><body data-page="' +
    page +
    '" data-mode="' +
    (practice ? "demo" : "real") +
    '"><div id="app">' +
    inside +
    '</div><noscript>Activa JavaScript para usar los formularios.</noscript><script type="module" src="/ui/app.js"></script></body></html>'
  );
}
