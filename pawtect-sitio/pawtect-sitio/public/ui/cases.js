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
  linkBtn,
  demoNotice,
  prio,
  pill,
  download,
} from "./common.js";
import { intro, support } from "./shell.js";
import { topics, priorities, states } from "./catalog.js";
const routes = {
  externa: "Protección independiente de Pawtect",
  colegio: "Convivencia de tu colegio",
  psicologia: "Psicología",
};
const listTitle = (t) =>
  '<span class="tile ' +
  (t.kind === "psicologia" ? "mint" : "violet") +
  '">' +
  icon(t.kind === "psicologia" ? "Headphones" : "FileText") +
  "</span><span><b>" +
  esc(t.subject) +
  "</b><small>" +
  esc(t.id) +
  " · " +
  esc(t.state) +
  '</small></span><span class="push">' +
  prio(t.priority) +
  "</span>";
export async function requestScreen(psy = false) {
  const u = state.u;
  if (u.demo && u.realOn && !state.demoConfirmed) {
    body(
      intro(
        "ACCESO INSTITUCIONAL",
        psy ? "Hablar con psicología" : "Pedir ayuda",
        "Entra con tu cuenta del colegio para que el equipo reciba tu consulta.",
        "LockKeyhole",
      ) +
        '<div class="card stack">' +
        linkBtn("/login.html", "Entrar con mi cuenta", "LogIn") +
        abtn(
          "practiceHelp",
          "Practicar con un ejemplo ficticio",
          "Sparkles",
          psy ? "psicologia" : "caso",
        ) +
        "</div>",
    );
    return;
  }
  if (u.role !== "estudiante") {
    body(
      intro(
        "ATENCIÓN",
        psy ? "Psicología" : "Pedir ayuda",
        "Las consultas que te corresponde atender están en tu panel.",
        "HandHeart",
      ) + linkBtn("/gestion.html", "Ver bandeja", "ClipboardList"),
    );
    return;
  }
  const profile = await api("profile");
  const writeFields =
    (psy
      ? ""
      : field(
          "Título breve",
          "subject",
          'minlength="3" maxlength="100" required placeholder="Por ejemplo, algo que pasó en el recreo"',
        ) +
        '<div class="grid2">' +
        select("¿Qué pasó?", "category", [
          ["", "Elige una opción"],
          ...topics,
        ]) +
        select("¿A quién involucra?", "actor", [
          ["", "Elige una opción"],
          ["estudiante", "Otro estudiante"],
          ["docente", "Un docente o trabajador"],
          ["directivo", "Un directivo"],
          ["otro", "Otra persona"],
        ]) +
        "</div>") +
    area(
      psy ? "¿Qué te gustaría conversar?" : "Cuéntanos lo que pasó",
      "body",
      'minlength="10" maxlength="5000" required placeholder="Puedes empezar por cómo te sentiste o por algo que viste."',
    ) +
    select("¿Con qué urgencia necesitas apoyo?", "priority", priorities) +
    '<div id="route-info" aria-live="polite"></div>' +
    '<details class="attachment-choice"><summary>' +
    icon("Paperclip", 18) +
    ' Añadir archivos <span>Opcional</span></summary><label class="field">Seleccionar archivos<input type="file" name="files" accept="image/jpeg,image/png,application/pdf" multiple><small>Hasta tres JPG, PNG o PDF. Máximo 3 MB entre todos.</small></label></details>';
  const reviewFields =
    '<div class="recipient-panel"><span class="tile mint">' +
    icon("LockKeyhole", 21) +
    '</span><div><small>Quién recibirá tu mensaje</small><strong id="review-recipient"></strong><p id="review-reason"></p></div></div>' +
    '<dl id="review-summary" class="request-summary"></dl><div class="request-permissions" role="group" aria-labelledby="permission-title"><h3 id="permission-title">Permisos opcionales</h3>' +
    check(
      "share",
      "Quiero que el equipo que atiende mi caso pueda consultar mi identidad.",
    ) +
    (profile.hasFamily
      ? check(
          "family",
          "Quiero que mi familiar autorizado reciba un aviso por correo.",
        )
      : "") +
    "</div>" +
    check(
      "ack",
      "Entiendo que el equipo asignado puede consultar mi identidad si doy permiso o si valora mi caso como urgente. Cada consulta queda registrada.",
      true,
    );
  const form = actionForm(
    "helpform",
    '<ol class="request-progress" aria-label="Pasos de la solicitud"><li aria-current="step">1. Escribir</li><li>2. Revisar y enviar</li></ol>' +
      '<fieldset id="request-write" class="request-step"><legend tabindex="-1">Tu mensaje</legend>' +
      writeFields +
      "</fieldset>" +
      '<fieldset id="request-review" class="request-step" hidden disabled><legend tabindex="-1">Revisa tu solicitud</legend>' +
      reviewFields +
      "</fieldset>" +
      '<div class="request-controls"><button type="button" id="edit-request" class="outline-btn" hidden>Volver a editar</button>' +
      btn("Revisar mi mensaje", "Eye") +
      "</div>",
  );
  body(
    intro(
      "",
      psy ? "Hablar con psicología" : "Pedir ayuda",
      psy
        ? "Puedes empezar con unas líneas. Tu conversación llega al equipo de psicología."
        : "Puedes contar en privado algo que te pasó o que viste. Antes de enviar, verás quién recibirá tu mensaje.",
      psy ? "Headphones" : "HandHeart",
    ) +
      '<div class="request-layout"><section class="card request-card">' +
      demoNotice() +
      form +
      '</section><aside class="request-aside">' +
      '<section class="card"><h2><span class="tile peach">' +
      icon("ShieldAlert", 20) +
      '</span>Si hay peligro ahora</h2><p>Busca a una persona adulta de confianza que esté cerca. El equipo revisa este formulario por turnos.</p><a href="https://www.gob.pe/62013-siseve" target="_blank" rel="noopener">Canal oficial SíseVe</a></section>' +
      '<section class="card"><h2><span class="tile violet">' +
      icon("ShieldCheck", 20) +
      '</span>Tu privacidad</h2><p>Tu consulta es privada. Tus compañeros no la ven en el foro.</p><a href="/normas.html">Quién puede ver mis datos</a></section>' +
      (psy
        ? '<a class="outline-btn" href="/casos.html?tipo=psicologia">' +
          icon("MessagesSquare", 17) +
          " Ver mis consultas anteriores</a>"
        : "") +
      "</aside></div>",
  );
  const f = $("#helpform"),
    write = $("#request-write"),
    review = $("#request-review"),
    back = $("#edit-request"),
    submit = f.querySelector("button[type=submit]");
  const requestId = crypto.randomUUID();
  const recipient = () => {
    if (psy)
      return [
        "Psicología",
        "Tu consulta llega al equipo de psicología designado para tu colegio.",
      ];
    if (["directivo", "docente"].includes(f.elements.actor.value))
      return [
        "Protección independiente de Pawtect",
        "Como señalaste a un docente, trabajador o directivo, el equipo del plantel queda fuera de este expediente.",
      ];
    if (f.elements.actor.value)
      return [
        "Convivencia de tu colegio",
        "El equipo de convivencia de tu colegio recibe el caso y puede responderte en Mis casos.",
      ];
    return [
      "Elige a quién involucra",
      "Así podrás ver quién atenderá tu solicitud.",
    ];
  };
  const showRoute = () => {
    const urgent = f.elements.priority.value === "Urgente";
    const [team, explanation] = recipient();
    $("#route-info").innerHTML = notice(
      "<b>" +
        esc(team) +
        "</b><br>" +
        esc(explanation) +
        (urgent
          ? " Si hay peligro inmediato, busca apoyo presencial ahora."
          : ""),
      urgent ? "ShieldAlert" : "LockKeyhole",
      urgent ? "peach" : "mint",
    );
  };
  f.elements.actor?.addEventListener("change", () => {
    if (f.elements.share) f.elements.share.checked = false;
    showRoute();
  });
  f.elements.priority.addEventListener("change", showRoute);
  showRoute();
  const goToStep = (second) => {
    write.hidden = second;
    review.hidden = !second;
    review.disabled = !second;
    back.hidden = !second;
    [...f.querySelectorAll(".request-progress li")].forEach((item, i) => {
      if (i === Number(second)) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });
    submit.innerHTML =
      icon(second ? "Send" : "Eye", 17) +
      (second
        ? psy
          ? "Enviar consulta privada"
          : "Enviar solicitud"
        : "Revisar mi mensaje");
    const title = (second ? review : write).querySelector("legend");
    title.focus();
  };
  back.onclick = () => {
    if (!f.dataset.busy) {
      f.querySelector(".feedback").textContent = "";
      f.elements.ack.checked = false;
      goToStep(false);
    }
  };
  bindForm("#helpform", async (b) => {
    const files = Array.from(f.elements.files.files);
    if (files.length > 3 || files.reduce((n, x) => n + x.size, 0) > 3145728)
      throw Error("Elige hasta tres archivos y un máximo total de 3 MB.");
    if (files.some((file) => !file.size))
      throw Error(
        "Uno de los archivos está vacío. Selecciona un archivo con contenido.",
      );
    if (review.hidden) {
      const [team, explanation] = recipient();
      $("#review-recipient").textContent = team;
      $("#review-reason").textContent = explanation;
      const items = [
        ...(psy
          ? []
          : [
              ["Título", b.subject],
              ["Situación", b.category],
            ]),
        ["Tu mensaje", b.body],
        ["Urgencia que elegiste", b.priority],
        [
          "Archivos",
          files.length
            ? files.map((file) => file.name).join(", ")
            : "Sin adjuntos",
        ],
      ];
      $("#review-summary").innerHTML = items
        .map(
          ([label, value]) =>
            "<div><dt>" + esc(label) + "</dt><dd>" + esc(value) + "</dd></div>",
        )
        .join("");
      goToStep(true);
      return;
    }
    const d = new FormData();
    d.set(
      "data",
      JSON.stringify({
        ...b,
        requestId,
        kind: psy ? "psicologia" : "caso",
        ack: !!b.ack,
        share: !!b.share,
        family: !!b.family,
      }),
    );
    for (const file of files) d.append("files", file);
    const v = await api("newTicket", d);
    body(
      intro(
        "SOLICITUD RECIBIDA",
        psy ? "Tu conversación está abierta" : "Tu caso está registrado",
        "Conserva este código. Puedes volver desde Mis casos para ver el seguimiento.",
        "CircleCheck",
      ) +
        '<div class="card stack"><p class="code">' +
        esc(v.id) +
        "</p><p>Ruta de atención · " +
        esc(routes[v.route]) +
        "</p><div>" +
        prio(v.priority) +
        '</div><div class="btn-row">' +
        linkBtn(
          "/casos.html?id=" + encodeURIComponent(v.id),
          "Abrir seguimiento",
          "ClipboardList",
        ) +
        "</div></div>",
    );
    scrollTo(0, 0);
  });
}
export async function listScreen(staff = false, container = null) {
  const data = await api("tickets");
  const isPsy = params.get("tipo") === "psicologia";
  const content =
    '<div class="card stack"><div class="grid2">' +
    field(
      "Buscar por título o código",
      "query",
      'id="caseq" type="search" placeholder="Título o PT-…"',
    ) +
    select("Filtrar por estado", "state", ["Todos", ...states]) +
    '</div><div id="case-items" class="list"></div></div>';
  if (container) container.innerHTML = content;
  else
    body(
      intro(
        staff ? "ATENCIÓN" : "",
        staff ? "Bandeja de atención" : "Mis casos",
        staff
          ? "Las solicitudes urgentes aparecen primero."
          : "Revisa el estado de tus consultas y conversa con el equipo que te acompaña.",
        "ClipboardList",
      ) + content,
    );
  const box = $("#case-items"),
    sel = $("select[name=state]", box.parentElement),
    q = $("#caseq");
  const show = () => {
    const match = data.items.filter(
      (t) =>
        (!isPsy || t.kind === "psicologia") &&
        (sel.value === "Todos" || t.state === sel.value) &&
        (t.subject + " " + t.id)
          .toLowerCase()
          .includes(q.value.toLowerCase().trim()),
    );
    box.innerHTML = match.length
      ? match
          .map((t) => {
            const main =
              '<button class="list-item" data-act="ticket" data-val="' +
              esc(t.id) +
              '">' +
              listTitle(t) +
              "</button>";
            if (staff) return main;
            const peek = t.last_at
              ? '<details class="message-peek" data-ticket="' +
                esc(t.id) +
                '"><summary>' +
                icon("MessageCircle", 16) +
                " Último mensaje <time>" +
                stamp(t.last_at) +
                '</time></summary><p aria-live="polite"></p></details>'
              : '<p class="case-wait">' +
                icon("Clock", 15) +
                " Aún no hay mensajes de seguimiento.</p>";
            return '<div class="case-item">' + main + peek + "</div>";
          })
          .join("")
      : empty(
          "Sin casos en esta vista",
          "Prueba con otro filtro o inicia una solicitud.",
          "ClipboardList",
        );
  };
  box.addEventListener(
    "toggle",
    async (event) => {
      const details = event.target;
      if (
        !details.matches?.(".message-peek") ||
        !details.open ||
        details.dataset.loaded
      )
        return;
      const content = details.querySelector("p");
      details.dataset.loaded = "pending";
      content.textContent = "Cargando el mensaje…";
      try {
        const { message } = await api(
          "lastMessage",
          { id: details.dataset.ticket },
          "GET",
        );
        content.textContent = message
          ? message.from + " · " + message.text
          : "Aún no hay mensajes de seguimiento.";
        if (message)
          details.querySelector("time").textContent = stamp(message.at);
        details.dataset.loaded = "yes";
      } catch (error) {
        delete details.dataset.loaded;
        content.textContent =
          error.message +
          " Cierra y vuelve a abrir el último mensaje para reintentar.";
      }
    },
    true,
  );
  q.oninput = show;
  sel.onchange = show;
  show();
}
export async function ticketDetail(id) {
  const t = await api("ticket", { id }, "GET");
  state.ticket = t;
  let html =
    intro(
      t.kind === "psicologia" ? "PSICOLOGÍA" : "SEGUIMIENTO",
      t.subject,
      t.id,
      "ClipboardList",
    ) +
    '<div class="two-col"><div class="stack"><section class="card stack"><div class="status-line">' +
    pill(t.state) +
    prio(t.priority) +
    '</div><div class="fine">' +
    esc(routes[t.route]) +
    " · " +
    stamp(t.created) +
    '</div><p class="read-box">' +
    esc(t.body) +
    '</p><p class="fine">Alias · ' +
    esc(t.alias) +
    (t.assigned ? " · Responsable: " + esc(t.assigned) : "") +
    "</p>" +
    (t.files.length
      ? '<div class="btn-row">' +
        t.files
          .map((f) =>
            state.u.demo
              ? '<button class="outline-btn" data-act="practiceFile" data-val="' +
                esc(f.id) +
                '" data-name="' +
                esc(f.name) +
                '">' +
                icon("Download", 17) +
                esc(f.name) +
                "</button>"
              : linkBtn(
                  "/api/pawtect?action=file&id=" + encodeURIComponent(f.id),
                  f.name + " (" + Math.ceil(f.size / 1024) + " KB)",
                  "Download",
                  "outline-btn",
                ),
          )
          .join("") +
        "</div>"
      : "") +
    '</section><section class="card stack"><h2>Conversación y seguimiento</h2>' +
    (t.events.length
      ? t.events
          .map(
            (e) =>
              '<div class="log-item"><b>' +
              esc(e.label) +
              (e.internal ? " · Nota interna" : "") +
              "</b><small>" +
              stamp(e.created) +
              "</small><p>" +
              esc(e.body) +
              "</p></div>",
          )
          .join("")
      : '<p class="fine">Los mensajes y cambios de estado aparecerán aquí.</p>') +
    actionForm(
      "eventForm",
      area(
        "Añadir un mensaje",
        "body",
        'minlength="2" maxlength="3000" required',
      ) +
        (t.staff
          ? check("internal", "Guardar como nota interna del equipo.")
          : "") +
        btn("Enviar mensaje", "Send"),
    ) +
    '</section></div><aside class="stack"><section class="card stack"><h3>Opciones del caso</h3>' +
    abtn("reportCopy", "Generar copia del informe", "FileText", id) +
    (t.canIdentify
      ? abtn("identify", "Consultar identidad", "Fingerprint", id)
      : "") +
    linkBtn(
      t.staff ? "/gestion.html" : "/casos.html",
      "Volver a la bandeja",
      "ClipboardList",
      "outline-btn",
    ) +
    "</section>";
  if (t.staff)
    html +=
      '<section class="card stack"><h3>Atender y asignarme</h3>' +
      actionForm(
        "manageForm",
        select("Estado", "state", states, t.state) +
          select("Urgencia", "priority", priorities, t.priority) +
          area(
            "Nota visible para el estudiante",
            "reason",
            'minlength="5" maxlength="500" required',
          ) +
          btn("Guardar seguimiento", "Check"),
      ) +
      "</section>";
  body(html + "</aside></div>");
  scrollTo(0, 0);
  bindForm("#eventForm", async (b) => {
    await api("event", { ...b, id, internal: !!b.internal });
    await ticketDetail(id);
    toast("Mensaje guardado.");
  });
  bindForm("#manageForm", async (b) => {
    await api("manage", { ...b, id });
    await ticketDetail(id);
    toast("Seguimiento actualizado.");
  });
}
export function identifyDialog(id, forum = false) {
  dialog(
    "Acceso a identidad",
    '<p class="dialog-desc">La cuenta, el motivo y la fecha de esta consulta quedarán en la auditoría.</p>' +
      actionForm(
        "identifyForm",
        area(
          "Justificación del acceso",
          "reason",
          'minlength="15" maxlength="450" required',
        ) + btn("Registrar y consultar", "Fingerprint"),
      ),
  );
  bindForm("#identifyForm", async (b) => {
    const person = await api(forum ? "forumIdentity" : "identify", {
      id,
      ...b,
    });
    dialog(
      "Identidad autorizada",
      '<dl class="kv">' +
        [
          ["Nombre", person.name],
          ["DNI", person.dni],
          ["Grado", person.grade],
          ["Correo institucional", person.email],
        ]
          .map(
            ([k, v]) =>
              "<dt>" + k + "</dt><dd>" + esc(v || "Sin dato") + "</dd>",
          )
          .join("") +
        "</dl>",
    );
  });
}
export async function reportCopy(id) {
  const r = await api("export", { id }),
    lines = [
      "PAWTECT · COPIA DE SEGUIMIENTO",
      r.id,
      "Emitido el " + stamp(Math.floor(Date.now() / 1000)),
      "",
      "Asunto: " + r.subject,
      "Fecha de ingreso: " + stamp(r.created),
      "Alias: " + r.alias,
      "Estado: " + r.state,
      "Prioridad: " + r.priority,
      "Equipo: " + routes[r.route],
      "",
      "Relato",
      r.body,
      "",
      "Seguimiento compartido",
      ...r.events.map(
        (e) => stamp(e.created) + " · " + e.label + "\n" + e.body,
      ),
    ];
  const report = lines.join("\n");
  dialog(
    "Copia del informe",
    '<p class="dialog-desc">Incluye el relato y las notas compartidas. Revisa el texto antes de entregarlo.</p><div class="btn-row">' +
      abtn("pdfReport", "Imprimir o guardar PDF", "Download") +
      abtn("txtReport", "Descargar texto", "FileText") +
      "</div>",
  );
  $("#dialog-content [data-act=txtReport]").onclick = () =>
    download(id + ".txt", report);
  $("#dialog-content [data-act=pdfReport]").onclick = () => {
    const w = window.open("", "_blank");
    if (!w) {
      toast("Permite la ventana de impresión o descarga el texto.");
      return;
    }
    w.opener = null;
    w.document.write(
      '<!doctype html><html lang="es"><meta charset="utf-8"><title>Informe ' +
        esc(id) +
        "</title><style>body{font:15px/1.6 system-ui;margin:36px;color:#292436}h1{color:#6238b6}pre{white-space:pre-wrap;font:inherit}</style><h1>Pawtect</h1><pre>" +
        esc(report) +
        "</pre></html>",
    );
    w.document.close();
    w.focus();
    w.print();
  };
}
