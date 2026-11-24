import { isPractice, pageUrl, scopeLinks } from "./routing.js";
import { moods, guides, guideContent } from "./campus.js";
import {
  state,
  params,
  $,
  api,
  chrome,
  body,
  esc,
  icon,
  toast,
  dialog,
  close,
  abtn,
  empty,
  stamp,
  pageFail,
  download,
} from "./common.js";
import { initialUser, home } from "./shell.js";
import { communityAct, loadFeed } from "./community.js";
import {
  requestScreen,
  listScreen,
  ticketDetail,
  identifyDialog,
  reportCopy,
} from "./cases.js";
import { account, accountAct } from "./account.js";
import { manage, adminAct } from "./admin.js";
import { schools, rules, guide } from "./info.js";
let ready;
async function render() {
  const p = state.page;
  if (state.u.mustChange && p !== "login") {
    location.replace(pageUrl("/login.html?next=" + encodeURIComponent(p)));
    return;
  }
  if (p === "inicio") {
    // Preserve a student's early check-in when the session response arrives.
    if (state.u.guest || state.u.role === "estudiante") return;
    const entry = $(".campus-hero .primary-campus");
    if (entry) {
      entry.href = pageUrl("/gestion.html");
      entry.innerHTML = icon("LayoutDashboard", 20) + " Abrir mi panel";
    }
    return;
  }
  if (
    state.u.guest &&
    ["ayuda", "psicologia", "casos", "gestion", "foro"].includes(p)
  ) {
    const entry = {
      ayuda: [
        "Pedir ayuda en privado",
        "Puedes contar lo que pasó y adjuntar una imagen o un PDF. Si señalas a un docente o directivo, lo recibe el equipo independiente de Pawtect.",
      ],
      psicologia: [
        "Hablar con psicología",
        "Escribe cuando te sientas listo. Solo tú y el equipo autorizado pueden abrir esta conversación. La respuesta depende del horario acordado con tu colegio.",
      ],
      casos: [
        "Seguir mi caso",
        "Entra para leer las respuestas, ver quién atiende tu caso y añadir algo que quieras contar.",
      ],
      gestion: [
        "Panel de gestión",
        "El personal autorizado puede entrar con su cuenta institucional para abrir su bandeja.",
      ],
      foro: [
        "Foro estudiantil",
        "Comparte experiencias, pide consejos o apoya a otros estudiantes de tu colegio. Tus compañeros te ven por tu alias.",
      ],
    }[p];
    return body(
      '<section class="entry-gate"><div class="campus-kicker">' +
        icon("LockKeyhole", 16) +
        " ACCESO INSTITUCIONAL</div><h1>" +
        entry[0] +
        "</h1><p>" +
        entry[1] +
        '</p><div class="hero-links"><a class="primary-campus" href="/login.html?next=' +
        p +
        '">' +
        icon("LogIn", 18) +
        ' Ingresar con mi cuenta</a><a class="hero-text" href="/demo/' +
        p +
        '.html">Probar la demo ' +
        icon("ArrowUpRight", 16) +
        "</a></div></section>",
    );
  }
  if (p === "foro") return loadFeed();
  if (p === "ayuda" || p === "psicologia")
    return requestScreen(p === "psicologia");
  if (p === "casos")
    return params.get("id") ? ticketDetail(params.get("id")) : listScreen();
  if (p === "gestion") return manage(params.get("tab") || "");
  if (p === "login") return account();
  if (p === "colegios") return schools();
  if (p === "normas") return rules();
  if (p === "guia") return guide();
}
async function boot() {
  try {
    state.u = await api("session", {});
    chrome();
    await render();
  } catch (e) {
    state.u = state.u || initialUser;
    if (state.page === "inicio" && !isPractice) return;
    else if (state.page === "guia") guide();
    else if (state.page === "normas") rules();
    else pageFail(e.message);
  }
}
async function notifications() {
  const v = await api("notices");
  dialog(
    "Notificaciones",
    v.items.length
      ? '<div class="list">' +
          v.items
            .map(
              (n) =>
                '<a class="list-item" href="' +
                esc(n.url) +
                '"><span class="tile violet">' +
                icon("Bell", 17) +
                "</span><span><b>" +
                esc(n.title) +
                "</b><small>" +
                esc(n.detail) +
                "</small><small>" +
                stamp(n.created) +
                "</small></span></a>",
            )
            .join("") +
          "</div>"
      : empty(
          "No tienes avisos",
          "Aquí verás novedades sobre tus casos y publicaciones.",
          "Bell",
        ),
  );
  await api("markSeen", {});
  state.u.unread = 0;
  chrome();
}
document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const a = el.dataset.act;
  if (a === "quick") {
    e.preventDefault();
    location.replace("/apuntes.html");
    return;
  }
  if (a === "resetDemo") {
    dialog(
      "¿Reiniciar esta práctica?",
      '<p class="dialog-desc">Se borrarán los casos, publicaciones y archivos ficticios que añadiste en esta pestaña.</p><div class="btn-row">' +
        abtn("confirmReset", "Reiniciar práctica", "Check") +
        abtn("close", "Volver", "X") +
        "</div>",
    );
    return;
  }
  if (a === "leaveDemo" || a === "confirmReset") {
    const { clearPractice } = await import("./practice.js");
    clearPractice();
    location.replace(a === "leaveDemo" ? "/" : "/demo/index.html");
    return;
  }
  if (a === "mood") {
    const m = moods[Number(el.dataset.val)];
    if (!m) return;
    for (const button of document.querySelectorAll("[data-act=mood]"))
      button.setAttribute("aria-pressed", String(button === el));
    $("#mood-result").innerHTML =
      esc(m[3]) + ' <a href="' + pageUrl(m[5]) + '">' + esc(m[4]) + " →</a>";
    return;
  }
  if (a === "readGuide" || a === "copyPhrase") {
    const g = guides.find((x) => x.id === el.dataset.val);
    if (!g) return;
    if (a === "readGuide") dialog(g.name, guideContent(g));
    else {
      try {
        await navigator.clipboard.writeText(g.phrase);
        toast("Frase copiada.");
      } catch {
        const sel = getSelection();
        const range = document.createRange();
        range.selectNodeContents($(".phrase"));
        sel.removeAllRanges();
        sel.addRange(range);
        toast("Frase seleccionada. Puedes copiarla.");
      }
    }
    return;
  }
  if (a === "practiceFile") {
    e.preventDefault();
    try {
      download(
        el.dataset.name,
        await api("file", { id: el.dataset.val }, "GET"),
      );
    } catch (error) {
      toast(error.message);
    }
    return;
  }
  if (a === "menu") {
    const opened = document.body.classList.toggle("menu-open");
    $("#hamburger").setAttribute("aria-expanded", String(opened));
    if (opened) $("#sidebar a")?.focus();
    return;
  }
  if (a === "closeMenu") {
    document.body.classList.remove("menu-open");
    $("#hamburger")?.setAttribute("aria-expanded", "false");
    $("#hamburger")?.focus();
    return;
  }
  if (a === "close" || a === "dismissDialog") {
    close();
    return;
  }
  if (a === "reload") {
    location.reload();
    return;
  }
  if (!state.u) await ready;
  if (!state.u) return;
  if (el.dataset.working) return;
  el.dataset.working = "1";
  try {
    if (a === "notices") await notifications();
    else if (a === "ticket")
      location.href =
        pageUrl(state.page === "gestion" ? "/gestion.html" : "/casos.html") +
        "?id=" +
        encodeURIComponent(el.dataset.val);
    else if (a === "practiceHelp") {
      state.demoConfirmed = true;
      await requestScreen(el.dataset.val === "psicologia");
    } else if (a === "identify") identifyDialog(el.dataset.val);
    else if (a === "reportCopy") await reportCopy(el.dataset.val);
    else if (!(await communityAct(a, el)) && !(await accountAct(a, el)))
      await adminAct(a, el);
  } catch (err) {
    toast(err.message);
  } finally {
    delete el.dataset.working;
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.body.classList.contains("menu-open")) {
    document.body.classList.remove("menu-open");
    $("#hamburger")?.setAttribute("aria-expanded", "false");
    $("#hamburger")?.focus();
  }
});
$("#dialog").addEventListener("click", (e) => {
  if (e.target.id === "dialog") close();
});
if (isPractice) {
  scopeLinks(document);
  new MutationObserver((records) => {
    for (const r of records) {
      for (const child of r.addedNodes) scopeLinks(child);
    }
  }).observe(document.body, { subtree: true, childList: true });
}
ready = boot();
