import { bindRoster } from "./padron.js";
import {
  state,
  params,
  $,
  api,
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
  linkBtn,
  demoNotice,
  pill,
  download,
} from "./common.js";
import { intro } from "./shell.js";
import { roles } from "./catalog.js";
import { listScreen, ticketDetail, identifyDialog } from "./cases.js";
const tabsByRole = {
  plantel: ["casos", "moderacion", "cuentas"],
  psicologia: ["casos"],
  equipo: ["casos", "moderacion"],
  admin: ["colegios", "cuentas", "moderacion", "auditoria", "correo"],
};
const labels = {
  casos: "Casos",
  moderacion: "Moderación",
  cuentas: "Cuentas",
  colegios: "Colegios",
  auditoria: "Auditoría",
  correo: "Correo",
};
export async function manage(tab = "") {
  const options = tabsByRole[state.u.role];
  if (!options) {
    body(
      intro(
        "MI ESPACIO",
        "Acceso por rol",
        "El panel de gestión pertenece a los equipos designados.",
        "ShieldCheck",
      ) + linkBtn("/casos.html", "Ver mis casos", "ClipboardList"),
    );
    return;
  }
  const active = options.includes(tab) ? tab : options[0];
  state.tab = active;
  body(
    intro(
      "PANEL INSTITUCIONAL",
      roles[state.u.role],
      state.u.role === "equipo"
        ? "Atiende los reportes que involucran a docentes o directivos, fuera del plantel señalado."
        : state.u.role === "psicologia"
          ? "Revisa consultas privadas, responde y acuerda el seguimiento."
          : "Gestiona las tareas asignadas a tu rol y revisa su seguimiento.",
      "LayoutDashboard",
    ) +
      '<div class="tabs">' +
      options
        .map(
          (k) =>
            '<button class="filter ' +
            (k === active ? "selected" : "") +
            '" data-act="adminTab" data-val="' +
            k +
            '">' +
            labels[k] +
            "</button>",
        )
        .join("") +
      '</div><div id="desk"></div>',
  );
  const desk = $("#desk");
  if (active === "casos") {
    if (params.get("id") && !state.deep) {
      state.deep = true;
      await ticketDetail(params.get("id"));
    } else await listScreen(true, desk);
  }
  if (active === "cuentas") {
    const { items } = await api("schools");
    if (!items.length) {
      desk.innerHTML = empty(
        "Registra primero un colegio",
        "En la pestaña Colegios puedes autorizar su dominio institucional.",
        "School",
      );
      return;
    }
    const options =
      state.u.role === "admin"
        ? ["estudiante", "plantel", "psicologia", "equipo"]
        : ["estudiante"];
    desk.innerHTML =
      '<div class="two-col"><div class="card stack"><h2>Generar una cuenta</h2>' +
      demoNotice() +
      actionForm(
        "memberForm",
        select(
          "Colegio",
          "school",
          items.map((s) => [s.id, s.name + " · @" + s.domain]),
        ) +
          '<div class="grid2">' +
          field(
            "DNI (8 dígitos)",
            "dni",
            'inputmode="numeric" pattern="[0-9]{8}" maxlength="8" required',
          ) +
          select(
            "Rol",
            "role",
            options.map((x) => [x, roles[x]]),
          ) +
          '</div><div><button type="button" class="outline-btn" data-roster="find">Buscar DNI en el padrón</button><p id="padron-status" class="form-note" aria-live="polite"></p></div>' +
          field(
            "Nombre completo",
            "name",
            'minlength="2" maxlength="90" required',
          ) +
          field(
            "Correo institucional registrado",
            "email",
            'type="email" required',
          ) +
          field("Grado o cargo", "grade", 'maxlength="50"') +
          field(
            "Correo familiar autorizado (opcional)",
            "family",
            'type="email"',
          ) +
          btn("Generar usuario y clave", "KeyRound"),
      ) +
      '</div><aside class="privacy-card"><span class="privacy-icon">' +
      icon("Fingerprint") +
      "</span><h3>Alta con DNI</h3><p>Importa los nombres, grados y correos institucionales del colegio. Luego busca un DNI para completar la ficha o permite el primer ingreso del estudiante con Google.</p>" +
      (state.u.demo
        ? '<p class="pad-top">Prueba el DNI ficticio <b>00000042</b> con el colegio de muestra.</p>'
        : "") +
      '<div class="pad-top btn-row"><button type="button" class="outline-btn" data-roster="import">Importar padrón CSV</button>' +
      abtn("renewInitial", "Renovar clave inicial", "KeyRound") +
      "</div></aside></div>";
    bindRoster(items);
    bindForm("#memberForm", async (b, f) => {
      const v = await api("memberAdd", b);
      f.reset();
      dialog(
        "Cuenta generada",
        '<p class="dialog-desc">Entrega estos datos por un canal privado. La clave se muestra una sola vez.</p><dl class="kv"><dt>Usuario</dt><dd class="code">' +
          esc(v.login) +
          '</dd><dt>Clave temporal</dt><dd class="code">' +
          esc(v.password) +
          "</dd><dt>Alias</dt><dd>" +
          esc(v.alias) +
          "</dd></dl>" +
          abtn("saveCreds", "Descargar credencial", "Download"),
      );
      $("#dialog-content [data-act=saveCreds]").onclick = () =>
        download(
          "credencial-pawtect.txt",
          "Usuario: " +
            v.login +
            "\nContraseña temporal: " +
            v.password +
            "\nAlias: " +
            v.alias,
        );
    });
  }
  if (active === "colegios") {
    const [schools, certs] = await Promise.all([api("schools"), api("certs")]);
    desk.innerHTML =
      '<div class="two-col"><section class="card stack"><h2>Solicitudes de certificación</h2>' +
      (certs.items.length
        ? certs.items
            .map(
              (c) =>
                '<div class="read-box"><b>' +
                esc(c.school) +
                "</b> " +
                pill(c.state) +
                '<p class="fine">' +
                esc(c.id) +
                " · " +
                esc(c.plan) +
                " · " +
                c.size +
                " estudiantes</p><p>" +
                esc(c.name) +
                " · " +
                esc(c.contact) +
                '</p><div class="pad-top">' +
                abtn("certUpdate", "Cambiar estado", "ClipboardCheck", c.id) +
                "</div></div>",
            )
            .join("")
        : empty(
            "Todavía no hay solicitudes",
            "Los formularios enviados desde Para colegios aparecen en esta bandeja.",
            "Award",
          )) +
      '</section><aside class="card stack"><h2>Colegios autorizados</h2>' +
      schools.items
        .map(
          (s) =>
            "<p><b>" +
            esc(s.name) +
            '</b><br><span class="fine">@' +
            esc(s.domain) +
            "</span></p>",
        )
        .join("") +
      actionForm(
        "schoolForm",
        field(
          "Nombre del colegio",
          "name",
          'required minlength="3" maxlength="100"',
        ) +
          field(
            "Dominio institucional",
            "domain",
            'required placeholder="colegio.edu.pe"',
          ) +
          btn("Registrar colegio", "School"),
      ) +
      "</aside></div>";
    bindForm("#schoolForm", async (b) => {
      await api("schoolAdd", b);
      await manage("colegios");
      toast("Colegio registrado.");
    });
  }
  if (active === "moderacion") {
    const { items } = await api("reviews");
    state.reviews = items;
    desk.innerHTML =
      '<div class="card stack"><h2>Revisión de conversaciones</h2>' +
      notice(
        "Lee el contexto. Citar una agresión o pedir apoyo no es motivo de sanción. La tercera advertencia confirmada genera una pausa de 24 horas.",
        "MessageCircleHeart",
      ) +
      (items.length
        ? items
            .map(
              (r) =>
                '<div class="read-box"><div class="status-line">' +
                pill(r.state) +
                " " +
                esc(r.alias) +
                '</div><h3 class="pad-top">' +
                esc(r.title || "Respuesta") +
                "</h3><p>" +
                esc(r.body) +
                '</p><p class="fine">' +
                esc(r.level) +
                " · " +
                esc(r.reason) +
                '</p><div class="btn-row pad-top">' +
                (r.state === "Pendiente"
                  ? abtn("moderate", "Revisar incidente", "ShieldCheck", r.id)
                  : "<b>" + esc(r.decision) + "</b>") +
                (r.decision === "Expulsión" && r.level === "Grave"
                  ? abtn("forumId", "Consultar identidad", "Fingerprint", r.id)
                  : "") +
                "</div></div>",
            )
            .join("")
        : empty(
            "La bandeja está al día",
            "Las publicaciones retenidas y los reportes de la comunidad aparecerán aquí.",
            "CircleCheck",
          )) +
      "</div>";
  }
  if (active === "auditoria") {
    const { items } = await api("audit");
    desk.innerHTML =
      '<div class="card stack"><h2>Registro de acciones</h2>' +
      (items.length
        ? items
            .map(
              (r) =>
                '<div class="log-item"><b>' +
                esc(r.action) +
                "</b><small>" +
                stamp(r.created) +
                " · " +
                esc(r.alias) +
                "</small><p>" +
                esc(r.reason) +
                "</p><small>" +
                esc(r.object) +
                "</small></div>",
            )
            .join("")
        : empty(
            "Aún no hay acciones registradas",
            "Aquí se documentan accesos a identidad, informes, altas y decisiones del equipo.",
            "FileText",
          )) +
      "</div>";
  }
  if (active === "correo") {
    const m = await api("mailStatus");
    desk.innerHTML =
      '<div class="card stack"><h2>Avisos por correo</h2>' +
      notice(
        state.u.demo
          ? "En la demo, los avisos quedan dentro de la aplicación."
          : m.configured
            ? "La entrega por correo está configurada."
            : "Configura el remitente y la clave de Resend para activar la entrega.",
        "Mail",
      ) +
      "<p>" +
      m.pending +
      " pendientes · " +
      m.review +
      " para revisar · " +
      m.sent +
      ' aceptados por el proveedor</p><div class="btn-row">' +
      abtn("retryMail", "Procesar avisos pendientes", "Send") +
      linkBtn(
        "/guia.html#correo",
        "Configurar correo",
        "BookOpen",
        "outline-btn",
      ) +
      "</div></div>";
  }
}
export async function adminAct(a, el) {
  const id = el.dataset.val;
  if (a === "adminTab") {
    await manage(id);
    return true;
  }
  if (a === "renewInitial") {
    dialog(
      "Renovar clave inicial",
      actionForm(
        "renewForm",
        notice(
          "Esta opción sirve para cuentas que todavía no cambiaron su primera contraseña.",
          "KeyRound",
        ) +
          field(
            "DNI de la cuenta",
            "dni",
            'inputmode="numeric" pattern="[0-9]{8}" required',
          ) +
          btn("Renovar clave", "KeyRound"),
      ),
    );
    bindForm("#renewForm", async (b) => {
      const v = await api("renewInitial", b);
      dialog(
        "Nueva credencial",
        '<p class="dialog-desc">La clave inicial anterior caducó. Entrega la nueva por un canal privado.</p><dl class="kv"><dt>Usuario</dt><dd>' +
          esc(v.login) +
          '</dd><dt>Clave inicial</dt><dd class="code">' +
          esc(v.password) +
          "</dd></dl>",
      );
    });
    return true;
  }
  if (a === "certUpdate") {
    dialog(
      "Revisar certificación",
      actionForm(
        "certUpd",
        select("Estado", "state", [
          "Recibida",
          "En evaluación",
          "Aprobada",
          "Observada",
        ]) + btn("Guardar", "Check"),
      ),
    );
    bindForm("#certUpd", async (b) => {
      await api("certUpdate", { id, ...b });
      close();
      await manage("colegios");
      toast("Solicitud actualizada.");
    });
    return true;
  }
  if (a === "moderate") {
    const r = state.reviews.find((x) => x.id === id);
    dialog(
      "Resolver incidente",
      actionForm(
        "modForm",
        notice(esc(r.body), "MessageSquareText") +
          select(
            "Gravedad verificada",
            "level",
            ["Revisión", "Grave"],
            r.level,
          ) +
          select("Decisión", "decision", [
            "Aprobar",
            "Retirar",
            "Advertencia",
            "Pausa de 24 h",
            "Pausa de 7 días",
            "Expulsión",
          ]) +
          area(
            "Motivo de la decisión",
            "reason",
            'minlength="8" maxlength="450" required',
          ) +
          btn("Aplicar decisión", "ShieldCheck"),
      ),
    );
    bindForm("#modForm", async (b) => {
      const out = await api("moderate", { id, ...b });
      close();
      await manage("moderacion");
      toast("Decisión registrada: " + out.decision);
    });
    return true;
  }
  if (a === "forumId") {
    identifyDialog(id, true);
    return true;
  }
  if (a === "retryMail") {
    const out = await api("retryMail", {});
    await manage("correo");
    toast(
      out.configured
        ? "Avisos aceptados: " + out.sent
        : "La entrega externa está sin configurar.",
    );
    return true;
  }
  return false;
}
