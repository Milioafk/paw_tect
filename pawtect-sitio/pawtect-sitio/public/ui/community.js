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
  bindForm,
  opts,
  field,
  select,
  area,
  btn,
  abtn,
  feedback,
  check,
  notice,
  empty,
  actionForm,
  stamp,
  formData,
} from "./common.js";
import { home, avatar, ago } from "./shell.js";
import { categories } from "./catalog.js";
export async function loadFeed() {
  const data = await api("feed");
  state.posts = data.items;
  paint();
  if (params.get("post") && !state.opened) {
    state.opened = true;
    const p = state.posts.find((p) => p.id === params.get("post"));
    if (p) {
      await comments(p.id);
      postEl(p.id)?.scrollIntoView({ block: "center" });
    }
  }
}
const paint = () => body(home(state.page, state.u, state.posts, state.filter));
const postEl = (id) =>
  Array.from(document.querySelectorAll("[data-post]")).find(
    (e) => e.dataset.post === id,
  );
export async function comments(id, keep = false) {
  const root = postEl(id);
  if (!root) return;
  const box = $(".thread", root);
  if (!keep && !box.hidden) {
    box.hidden = true;
    return;
  }
  const { items } = await api("comments", { id }, "GET");
  box.hidden = false;
  box.innerHTML =
    (items.length
      ? items
          .map(
            (p) =>
              '<div class="comment">' +
              avatar(p.avatar) +
              "<div><b>" +
              esc(p.alias) +
              "</b><p>" +
              esc(p.body) +
              '</p></div><button class="subtle-icon" data-act="flagComment" data-id="' +
              esc(p.id) +
              '" aria-label="Reportar respuesta">' +
              icon("Flag", 14) +
              "</button></div>",
          )
          .join("")
      : '<p class="fine">Sé la primera persona en responder con respeto.</p>') +
    (state.u.role === "estudiante"
      ? '<form class="comment-form"><input aria-label="Tu respuesta" maxlength="1800" minlength="2" required placeholder="Escribe una respuesta…"><button type="submit" class="btn brand-btn" aria-label="Enviar respuesta">' +
        icon("Send", 17) +
        "</button></form>"
      : "");
  const f = $("form", box);
  if (f)
    f.onsubmit = async (e) => {
      e.preventDefault();
      const send = $("button", f);
      send.disabled = true;
      try {
        const v = await api("publish", {
          parent: id,
          body: $("input", f).value,
        });
        toast(
          v.held ? "Tu respuesta pasó a revisión." : "Respuesta publicada.",
        );
        await loadFeed();
        await comments(id, true);
      } catch (x) {
        toast(x.message);
      } finally {
        send.disabled = false;
      }
    };
}
function flag(id) {
  dialog(
    "Reportar contenido",
    '<p class="dialog-desc">El equipo de moderación revisará el contexto de la conversación.</p>' +
      actionForm(
        "flagform",
        area(
          "¿Qué te preocupa?",
          "reason",
          'minlength="6" maxlength="400" required',
        ) + btn("Enviar reporte", "Flag"),
      ),
  );
  bindForm("#flagform", async (b) => {
    await api("flag", { id, ...b });
    close();
    toast("Tu reporte llegó a moderación.");
  });
}
export async function communityAct(a, el) {
  const id = el.dataset.id,
    p = state.posts.find((post) => post.id === id);
  if (a === "filter") {
    state.filter = el.dataset.val;
    paint();
    return true;
  }
  if (a === "compose") {
    dialog(
      "Crear publicación",
      '<p class="dialog-desc">Escribes como <b>' +
        esc(state.u.alias) +
        "</b>. Cuida los nombres y datos de otras personas.</p>" +
        actionForm(
          "compose",
          select("Categoría", "category", categories) +
            field(
              "Título",
              "title",
              'required minlength="3" maxlength="110" placeholder="¿Qué te gustaría compartir?"',
            ) +
            area(
              "Tu publicación",
              "body",
              'required minlength="2" maxlength="1800" placeholder="Cuéntalo con tus palabras…"',
            ) +
            btn("Publicar", "SquarePen"),
        ),
    );
    bindForm("#compose", async (b) => {
      const r = await api("publish", b);
      close();
      state.filter = "Todos";
      await loadFeed();
      toast(
        r.held
          ? "Tu publicación está en revisión. No se ha aplicado ninguna sanción."
          : "Tu publicación ya está en la comunidad.",
      );
    });
    return true;
  }
  if (a === "comments") {
    await comments(id);
    return true;
  }
  if (a === "like" || a === "save") {
    if (!p) return true;
    const key = a === "like" ? "liked" : "saved",
      on = !Number(p[key]);
    await api("reaction", {
      id,
      kind: a === "like" ? "apoyo" : "guardado",
      on,
    });
    p[key] = on ? 1 : 0;
    if (a === "like") p.hearts = Number(p.hearts) + (on ? 1 : -1);
    paint();
    if (a === "save")
      toast(
        on ? "Publicación guardada." : "Publicación retirada de tus guardados.",
      );
    return true;
  }
  if (a === "postMenu") {
    dialog(
      "Opciones de publicación",
      '<div class="stack">' +
        abtn("reportPost", "Reportar publicación", "Flag", id) +
        abtn("dismissDialog", "Volver a la conversación", "MessageCircle") +
        "</div>",
    );
    return true;
  }
  if (a === "reportPost" || a === "flagComment") {
    flag(el.dataset.val || id);
    return true;
  }
  return false;
}
