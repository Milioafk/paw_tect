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
  btn,
  abtn,
  check,
  notice,
  actionForm,
  linkBtn,
  demoNotice,
  download,
} from "./common.js";
import { intro, support } from "./shell.js";
const official = "https://www.gob.pe/62013-siseve";
export function rules() {
  body(
    intro(
      "ACUERDOS DE LA COMUNIDAD",
      "Privacidad y normas",
      "Estas reglas explican quién puede ver tus datos y cómo cuidamos las conversaciones.",
      "ShieldCheck",
    ) +
      '<div class="two-col"><div class="stack"><section class="card guide"><h2>Quién puede ver qué</h2><ul class="info-list"><li><b>Tus compañeros</b> ven tu alias, tus publicaciones y tus respuestas en el foro de tu colegio.</li><li><b>Convivencia escolar</b> atiende sus casos asignados. Puede consultar tu identidad si das permiso o si el caso se valora como urgente. Debe justificar la consulta y queda una huella en la auditoría.</li><li><b>Protección Pawtect</b> recibe los reportes que señalan a un docente, trabajador o directivo. El plantel queda fuera de ese expediente.</li><li><b>Psicología</b> recibe tus conversaciones privadas. Puedes volver desde Mis casos para continuar.</li><li><b>Tu familiar autorizado</b> recibe un aviso cuando eliges esa opción y hay un correo registrado. Los avisos por correo omiten el relato y los archivos.</li></ul></section><section class="card guide"><h2>Convivencia en el foro</h2><ol class="info-list"><li>Habla desde tu experiencia. Puedes contar algo difícil y citar lo ocurrido sin identificar a otras personas.</li><li>Cuida la privacidad. Evita nombres completos, teléfonos, DNI, enlaces personales y capturas de terceros.</li><li>Reporta amenazas, acoso, invitaciones a pelear y contenido sexual explícito desde el menú de cada publicación o respuesta.</li><li>Un filtro puede retener contenido. Una persona revisa el contexto y decide si lo publica, retira o sanciona.</li><li>Las medidas incluyen advertencias, pausas de 24 horas o 7 días y expulsión por infracciones graves confirmadas. La tercera advertencia registrada se convierte en una pausa de 24 horas. Los incidentes graves confirmados se comunican al equipo del colegio. Una consulta de identidad exige una justificación.</li><li>Para pedir revisión de una decisión, abre una solicitud privada e incluye el motivo. El acceso a ayuda y a psicología continúa durante una sanción del foro.</li></ol></section><section class="card guide"><h2>Sobre tus datos</h2><p>El piloto usa los datos del padrón autorizado para crear tu cuenta. Tu DNI y tu correo institucional quedan fuera de tu perfil público. Las evidencias se descargan desde el expediente por personas autorizadas.</p><p>Para pedir acceso, rectificación o eliminación, contacta al responsable designado por tu colegio. Antes de incorporar estudiantes reales, el colegio y el equipo deben comunicar sus contactos, acordar autorizaciones, plazos de conservación y atención de derechos.</p></section></div><aside class="stack"><section class="privacy-card"><span class="privacy-icon">' +
      icon("LockKeyhole") +
      '</span><h3>Proyecto universitario</h3><p>La demo guarda ejemplos en esta pestaña. Reiníciala o sal de la demo para borrarlos. Salida rápida abre unos apuntes de estudio. El historial del navegador puede conservar visitas previas.</p></section><section class="card"><h3>Canal oficial en Perú</h3><p class="prose">SíseVe del Ministerio de Educación permite reportar violencia escolar.</p><div class="pad-top">' +
      linkBtn(official, "Abrir SíseVe", "ExternalLink", "outline-btn") +
      "</div></section></aside></div>",
  );
}
export async function schools() {
  const u = state.u;
  body(
    intro(
      "INSTITUCIONES EDUCATIVAS",
      "Pawtect para colegios",
      "Un piloto para que tu comunidad pueda pedir ayuda de forma discreta y cada caso tenga seguimiento.",
      "School",
    ) +
      '<div class="stack"><div class="prices"><article class="price feature"><span class="pill violet">Piloto en Huancayo</span><strong>Sin costo</strong><p>Un aula o un grado para validar el acompañamiento.</p></article><article class="price"><small>Plan Base · por colegio</small><strong>S/ 200 <small>/ mes</small></strong><p>Plataforma, cuentas, gestión de casos y soporte.</p></article><article class="price"><small>Plan Premium · por colegio</small><strong>S/ 500 <small>/ mes</small></strong><p>Seguimiento reforzado, capacitación e informes.</p></article></div><p class="fine">Importes de referencia de la propuesta universitaria. Las condiciones del piloto y la tarifa final se acuerdan con cada colegio.</p><div class="two-col"><section class="card guide stack"><h2>Certificación Pawtect</h2><p>Reconocimiento anual del proyecto para colegios que implementan su protocolo de convivencia. El equipo revisa la evidencia antes de aprobarlo. El precio de una eventual emisión se acuerda en el convenio.</p><h3>Requisitos del piloto</h3><ul class="info-list"><li>Una carta de intención de la dirección y un aula o grado participante.</li><li>Un responsable de convivencia, un profesional de psicología y una ruta independiente para reportes sobre personal.</li><li>Un dominio institucional, padrón autorizado y acuerdos de privacidad con las familias.</li><li>Un taller de una hora y un acuerdo de seguimiento de los casos.</li></ul><h3>Cómo se solicita</h3><p>El colegio envía el formulario. Pawtect revisa los requisitos, acuerda el piloto y evalúa la entrega del reconocimiento al completar la capacitación y la puesta en marcha.</p></section><aside class="card"><h2>Accesorios con QR</h2><img class="products" id="product-preview" src="/media/pulseras.webp" alt="Prototipos de pulseras Pawtect con placa y código QR"><div class="product-choices"><button type="button" class="filter selected" data-photo="pulseras" aria-pressed="true">Placas</button><button type="button" class="filter" data-photo="trenzada" aria-pressed="false">Trenzada</button><button type="button" class="filter" data-photo="negra" aria-pressed="false">Negra</button></div><p class="prose">Pulseras, llaveros, collares y peluches conectan con el formulario privado. Precio propuesto por accesorio: <b>S/ 29.90</b>.</p><div class="divider"></div><div class="qrbox" id="qr"><h3>QR del formulario</h3></div></aside></div><section class="card stack" id="solicitud"><h2>Solicitar el piloto o certificado</h2>' +
      ((u.role === "estudiante" && !u.demo) || (u.guest && !u.applicationsOpen)
        ? notice(
            "Para solicitar el certificado, usa el acceso institucional del representante del colegio.",
            "School",
          )
        : (u.demo ? demoNotice() : "") +
          actionForm(
            "certForm",
            '<div class="grid2">' +
              field(
                "Colegio",
                "school",
                'required minlength="3" maxlength="100"',
              ) +
              field(
                "Representante",
                "name",
                'required minlength="3" maxlength="80"',
              ) +
              '</div><div class="grid2">' +
              field("Correo de contacto", "email", 'type="email" required') +
              field(
                "Estudiantes participantes",
                "size",
                'type="number" min="1" max="50000" required',
              ) +
              "</div>" +
              select("Plan de interés", "plan", [
                "Piloto gratuito",
                "Base",
                "Premium",
              ]) +
              check(
                "ack",
                "Represento a la institución y autorizo el contacto sobre esta solicitud.",
                true,
              ) +
              btn("Enviar solicitud", "Send"),
          )) +
      '</section><section class="card stack"><h2>Consultar una solicitud</h2>' +
      actionForm(
        "lookupCert",
        '<div class="grid2">' +
          field(
            "Código de solicitud",
            "id",
            'placeholder="CE-…" required maxlength="32"',
          ) +
          field(
            "Clave de consulta",
            "key",
            'autocomplete="off" placeholder="Opcional desde la cuenta solicitante"',
          ) +
          "</div>" +
          btn("Consultar estado", "Search"),
      ) +
      '<div id="certResult"></div></section></div>',
  );
  const designs = {
    pulseras: "Prototipos de pulseras Pawtect con placas y QR",
    trenzada: "Pulsera trenzada de Pawtect con medalla QR",
    negra: "Pulsera negra con el escudo y el QR de Pawtect",
  };
  for (const choice of document.querySelectorAll("[data-photo]"))
    choice.onclick = () => {
      const key = choice.dataset.photo;
      $("#product-preview").src = "/media/" + key + ".webp";
      $("#product-preview").alt = designs[key];
      for (const item of document.querySelectorAll("[data-photo]")) {
        const selected = item === choice;
        item.classList.toggle("selected", selected);
        item.setAttribute("aria-pressed", String(selected));
      }
    };
  bindForm("#lookupCert", async (b) => {
    const r = await api("certLookup", b);
    $("#certResult").innerHTML =
      notice(
        "<b>" + esc(r.school) + "</b><br>" + esc(r.id) + " · " + esc(r.state),
        "Award",
        "mint",
      ) +
      (r.state === "Aprobada"
        ? '<div class="pad-top">' +
          abtn(
            "printCertificate",
            "Imprimir o guardar certificado PDF",
            "Download",
          ) +
          "</div>"
        : "");
    const print = $("[data-act=printCertificate]");
    if (print)
      print.onclick = () => {
        const w = window.open("", "_blank");
        if (!w) {
          toast("Permite la ventana de impresión para guardar el PDF.");
          return;
        }
        w.opener = null;
        const start = new Date(r.issued * 1000),
          end = new Date(start);
        end.setUTCFullYear(end.getUTCFullYear() + 1);
        const fmt = (d) =>
          d.toLocaleDateString("es-PE", {
            timeZone: "America/Lima",
            dateStyle: "long",
          });
        w.document.write(
          '<!doctype html><html lang="es"><meta charset="utf-8"><title>Certificado Pawtect ' +
            esc(r.id) +
            "</title><style>body{font:18px/1.65 system-ui;color:#352449;padding:7%;border:6px solid #8260bd}h1{font-size:3em;line-height:1.05}strong{font-size:1.5em}small{display:block;margin-top:2em}</style><p>Pawtect · Equipo Gotita Azul</p><h1>Certificado de participación</h1><strong>" +
            esc(r.school) +
            "</strong><p>Reconocimiento del proyecto Pawtect por su participación en el programa de convivencia escolar.</p><p>Emisión " +
            fmt(start) +
            "<br>Vigencia hasta " +
            fmt(end) +
            "</p><small>" +
            esc(r.id) +
            " · Proyecto universitario</small></html>",
        );
        w.document.close();
        w.print();
      };
  });
  bindForm("#certForm", async (b) => {
    const v = await api("certApply", {
      ...b,
      ack: !!b.ack,
    });
    $("#solicitud").innerHTML =
      '<h2>Solicitud recibida</h2><p class="prose">Código de seguimiento <b class="code">' +
      esc(v.id) +
      '</b>. Clave de consulta <b class="code">' +
      esc(v.trackingKey) +
      "</b>. Guarda ambos para consultar el estado y descargar el certificado cuando se apruebe. " +
      (u.demo
        ? "Puedes verla desde la administración de la demo."
        : "El equipo revisará los datos del colegio.") +
      "</p>";
  });
  try {
    const { default: qrcode } = await import("./qrcode.mjs"),
      qr = qrcode(0, "M");
    qr.addData(location.origin + (u.demo ? "/demo/ayuda.html" : "/ayuda.html"));
    qr.make();
    const canvas = document.createElement("canvas"),
      n = qr.getModuleCount(),
      s = 7;
    canvas.width = canvas.height = (n + 8) * s;
    const c = canvas.getContext("2d");
    c.fillStyle = "white";
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = "#221b32";
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++)
        if (qr.isDark(y, x)) c.fillRect((x + 4) * s, (y + 4) * s, s, s);
    const url = canvas.toDataURL("image/png");
    $("#qr").insertAdjacentHTML(
      "beforeend",
      '<img alt="QR que abre el formulario de ayuda de este sitio" src="' +
        url +
        '"><a class="outline-btn" download="Pawtect-QR.png" href="' +
        url +
        '">' +
        icon("Download", 16) +
        " Descargar QR</a>",
    );
  } catch {
    $("#qr").insertAdjacentHTML(
      "beforeend",
      linkBtn("/ayuda.html", "Abrir formulario", "FileText", "outline-btn"),
    );
  }
}
export function guide() {
  body(
    intro(
      "PROYECTO UNIVERSITARIO",
      "Guía de Pawtect",
      "Prepara la exposición o conecta una instalación con tu colegio.",
      "BookOpen",
    ) +
      '<div class="two-col"><div class="stack"><article class="card guide"><h2>Presentarlo en clase</h2><ol><li>Abre <a href="/demo/index.html">Explorar la demo</a>. Es una simulación local que usa ejemplos inventados.</li><li>Como estudiante, abre <b>Pedir ayuda</b>, marca que el caso ficticio involucra a un docente y adjunta una imagen de prueba. Pulsa <b>Revisar mi mensaje</b>, comprueba qué equipo lo recibe y confirma el envío. Guarda el código para abrir Mis casos.</li><li>Selecciona <b>Cambiar rol</b>. Prueba Convivencia y Equipo Pawtect para ver a quién llega ese caso. Psicología tiene su propia bandeja.</li><li>En Administración → Cuentas selecciona <b>Buscar DNI en el padrón</b> y usa el ejemplo 00000042. También puedes importar el CSV de muestra.</li><li>Usa <b>Reiniciar</b> para empezar de cero o <b>Salir de la demo</b> para borrar la práctica de esa pestaña.</li></ol></article>' +
      '<article class="card guide"><h2>Publicarlo con Neon y Vercel</h2><p><a href="/descargas/Pawtect_base_Neon.sql" download>Descargar SQL para una base nueva</a> · <a href="/descargas/Pawtect_actualizar_padron.sql" download>Descargar actualización para la base anterior</a></p><ol><li>Descomprime el proyecto descargable. Abre en Visual Studio Code la carpeta que contiene <code>package.json</code>.</li><li>En el editor SQL de Neon ejecuta <code>sql/01_pawtect.sql</code> en una base nueva. Si tu base de Pawtect ya incluye la tabla <code>roster</code>, puedes seguir con el despliegue. Si usas el paquete anterior que todavía carece del padrón, aplica <code>sql/02_actualizar_padron.sql</code>.</li><li>Sube las carpetas a GitHub e importa el repositorio en Vercel. Selecciona Other y la raíz que contiene <code>vercel.json</code>.</li><li>En las variables del proyecto guarda <code>DATABASE_URL</code>, <code>PAWTECT_DATA_KEY</code> y <code>PAWTECT_SETUP_TOKEN</code>. La guía incluida explica cómo generar dos secretos distintos. Conserva la clave de datos de una instalación existente.</li><li>Despliega y entra en Ingresar → Activar la primera administración. Tras el alta, retira el código de instalación de Vercel y vuelve a desplegar.</li></ol></article>' +
      '<article class="card guide" id="google"><h2>Google y el padrón del colegio</h2><ol><li>Registra el colegio y su dominio de Google Workspace en Administración → Colegios.</li><li>En Google Cloud crea un cliente OAuth para aplicación web. Añade el origen HTTPS exacto de tu instalación y configura <code>GOOGLE_CLIENT_ID</code> en el alojamiento. Despliega los cambios.</li><li>En Administración → Cuentas selecciona el colegio y usa <b>Importar padrón CSV</b>. Las cuatro columnas son dni, nombre, grado y correo. La plantilla se descarga desde esa pantalla.</li><li>El estudiante puede entrar con un Google verificado que coincida con su ficha. Para el acceso con clave, busca el DNI y genera las credenciales. El usuario tiene la forma <code>DNI@pawtect.com</code>.</li><li>El personal activa su cuenta con la clave inicial y luego vincula su Google desde Mi cuenta.</li></ol></article></div>' +
      '<aside class="stack"><section class="privacy-card"><span class="privacy-icon">' +
      icon("PawPrint") +
      '</span><h3>Equipo Gotita Azul</h3><p>Laboratorio de Liderazgo e Innovación · Universidad Continental, Huancayo.</p></section><section class="card guide"><h3>Activar la instalación de Sites</h3><p>Configura <code>PAWTECT_ADMIN_EMAIL</code> con el correo del titular. Despliega y usa la primera administración con esa misma cuenta. Registra los responsables, el colegio y su dominio.</p></section><section class="card guide" id="correo"><h3>Avisos por correo</h3><p>Verifica tu dominio en Resend y configura <code>RESEND_API_KEY</code> y <code>EMAIL_FROM</code>. La administración puede revisar la cola y procesar avisos pendientes. Por correo se avisa de una actualización. El expediente se consulta dentro del portal.</p></section><section class="card guide"><h3>Antes de recibir casos reales</h3><p>Acuerda responsables, horarios, protocolo de urgencias, tiempo de conservación y contactos de privacidad con el colegio. Activa <code>PAWTECT_PILOT_OPEN=1</code> cuando el equipo pueda recibir solicitudes de instituciones.</p></section></aside></div>',
  );
  if (location.hash)
    requestAnimationFrame(() =>
      document.getElementById(location.hash.slice(1))?.scrollIntoView(),
    );
}
