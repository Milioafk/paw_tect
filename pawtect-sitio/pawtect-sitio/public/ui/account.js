import { isPractice, pageUrl, validNext } from "./routing.js";
import {
  state,
  params,
  $,
  api,
  body,
  chrome,
  esc,
  icon,
  toast,
  dialog,
  close,
  bindForm,
  field,
  btn,
  abtn,
  notice,
  actionForm,
  linkBtn,
} from "./common.js";
import { roles } from "./catalog.js";
import { intro } from "./shell.js";
const roleIcons = {
  estudiante: "Sprout",
  plantel: "School",
  psicologia: "Headphones",
  equipo: "ShieldCheck",
  admin: "Settings",
};
function finish(u) {
  const next = validNext(params.get("next"));
  location.href = pageUrl(
    u.mustChange
      ? "/login.html" +
          (next ? "?next=" + encodeURIComponent(params.get("next")) : "")
      : next || (u.role === "estudiante" ? "/" : "/gestion.html"),
  );
}
async function googleUI(link = false) {
  const target = $("#google");
  if (!target) return;
  if (!state.u.googleOn) {
    target.innerHTML =
      abtn(
        "googleSetup",
        link
          ? "Vincular Google institucional"
          : "Continuar con Google institucional",
        "Mail",
      ) +
      '<small class="fine">Disponible al conectar Google Workspace del colegio.</small>';
    return;
  }
  try {
    const cfg = await api("googleConfig");
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    await new Promise((res, rej) => {
      if (window.google?.accounts?.id) {
        res();
        return;
      }
      script.onload = res;
      script.onerror = () =>
        rej(
          new Error(
            "Google no está disponible. Prueba con tu usuario Pawtect.",
          ),
        );
      document.head.append(script);
    });
    google.accounts.id.initialize({
      client_id: cfg.clientId,
      nonce: cfg.nonce,
      callback: async (response) => {
        try {
          if (!link && $("#recover-google")?.checked) {
            dialog(
              "Recuperar contraseña",
              actionForm(
                "recoverForm",
                field(
                  "Contraseña nueva",
                  "password",
                  'type="password" minlength="12" maxlength="128" required autocomplete="new-password"',
                ) +
                  field(
                    "Repite la contraseña",
                    "repeat",
                    'type="password" minlength="12" required autocomplete="new-password"',
                  ) +
                  btn("Guardar y entrar", "KeyRound"),
              ),
            );
            bindForm("#recoverForm", async (b) => {
              if (b.password !== b.repeat)
                throw new Error("Las contraseñas deben coincidir.");
              finish(
                await api("googleRecover", {
                  credential: response.credential,
                  password: b.password,
                }),
              );
            });
            return;
          }
          const u = await api(link ? "googleLink" : "googleLogin", {
            credential: response.credential,
          });
          finish(u);
        } catch (e) {
          $("#google-msg").textContent = e.message;
        }
      },
    });
    google.accounts.id.renderButton(target, {
      type: "standard",
      theme: "outline",
      size: "large",
      shape: "rectangular",
      text: "continue_with",
      locale: "es",
    });
  } catch (e) {
    target.textContent = e.message;
  }
}
export async function account() {
  const u = state.u,
    profile = u.guest || u.mustChange ? {} : await api("profile");
  const login = actionForm(
    "loginForm",
    field(
      "DNI o usuario Pawtect",
      "login",
      'required maxlength="254" autocomplete="username" placeholder="Ej. 00000042"',
    ) +
      '<small id="login-hint" class="form-note" aria-live="polite"></small>' +
      field(
        "Contraseña",
        "password",
        'type="password" required maxlength="160" autocomplete="current-password"',
      ) +
      btn("Iniciar sesión", "LogIn"),
  );
  const change = actionForm(
    "pwForm",
    field(
      "Contraseña actual o temporal",
      "old",
      'type="password" required autocomplete="current-password"',
    ) +
      field(
        "Nueva contraseña",
        "password",
        'type="password" minlength="12" maxlength="128" required autocomplete="new-password"',
      ) +
      field(
        "Repite la nueva contraseña",
        "repeat",
        'type="password" minlength="12" maxlength="128" required autocomplete="new-password"',
      ) +
      btn("Guardar nueva contraseña", "KeyRound"),
  );
  const setup =
    '<details><summary>Activar la primera administración</summary><p class="fine pad-top">Para el titular del proyecto que configuró el correo propietario en Sites o el código de instalación en Vercel.</p><div class="form-block">' +
    actionForm(
      "ownerForm",
      field(
        "DNI del administrador",
        "dni",
        'inputmode="numeric" pattern="[0-9]{8}" required',
      ) +
        field("Correo del administrador", "email", 'type="email" required') +
        field(
          "Contraseña propia (12 o más caracteres)",
          "password",
          'type="password" minlength="12" required autocomplete="new-password"',
        ) +
        field(
          "Código de instalación de Vercel (si corresponde)",
          "token",
          'type="password" autocomplete="off"',
        ) +
        btn("Activar administración", "KeyRound"),
    ) +
    "</div></details>";
  const demo =
    '<aside class="card account-demo"><div class="eyebrow">' +
    icon("Sparkles", 15) +
    ' PROYECTO UNIVERSITARIO</div><h2 class="pad-top">Explorar la demo</h2><p class="prose">Prueba qué ve cada persona con datos ficticios en un espacio de práctica.</p><div class="role-grid">' +
    Object.entries(roles)
      .map(
        ([k, r]) =>
          '<button class="' +
          (u.role === k ? "selected" : "") +
          '" data-act="demoRole" data-val="' +
          k +
          '">' +
          icon(roleIcons[k], 17) +
          esc(r) +
          (u.role === k ? icon("Check", 16) : "") +
          "</button>",
      )
      .join("") +
    "</div></aside>";
  const local = !!u.guest;
  const heading = u.mustChange
    ? "Cambia tu clave inicial"
    : local
      ? "Iniciar sesión"
      : "Mi cuenta";
  let main =
    '<section class="card stack"><h2>' +
    (local
      ? "Acceso institucional"
      : u.mustChange
        ? "Elige tu contraseña"
        : "Tu perfil") +
    "</h2>";
  if (u.mustChange)
    main +=
      notice(
        "La clave temporal debe cambiarse antes de abrir el foro, el panel o los casos.",
        "KeyRound",
      ) + change;
  else if (local)
    main +=
      login +
      (u.googleOn
        ? '<label class="check"><input id="recover-google" type="checkbox">Recuperar mi contraseña con mi Google institucional vinculado</label>'
        : "") +
      '<div id="google" class="stack"></div><p id="google-msg" class="feedback"></p><p class="fine">¿Primera vez? Usa tu Google institucional si tu colegio ya importó el padrón. También puedes pedir tu usuario y clave inicial.</p>' +
      setup;
  else
    main +=
      '<dl class="kv"><dt>Alias</dt><dd>' +
      esc(u.alias) +
      "</dd><dt>Nombre del padrón</dt><dd>" +
      esc(profile.name || "Sin registrar") +
      "</dd><dt>Grado o cargo</dt><dd>" +
      esc(profile.grade || "Sin registrar") +
      "</dd>" +
      (profile.googleName
        ? "<dt>Nombre en Google</dt><dd>" + esc(profile.googleName) + "</dd>"
        : "") +
      "<dt>Rol</dt><dd>" +
      esc(roles[u.role]) +
      "</dd><dt>Institución</dt><dd>" +
      esc(u.school) +
      "</dd><dt>Correo registrado</dt><dd>" +
      esc(profile.email || "Sin registrar") +
      "</dd></dl>" +
      (!u.demo && u.role !== "admin"
        ? profile.linked
          ? notice(
              "Tu correo institucional está vinculado a Google.",
              "BadgeCheck",
              "mint",
            )
          : '<div id="google" class="stack"></div><p id="google-msg" class="feedback"></p>'
        : "") +
      (profile.hasPassword
        ? '<details><summary>Cambiar contraseña</summary><div class="form-block">' +
          change +
          "</div></details>"
        : profile.linked
          ? '<p class="form-note">Para crear una clave Pawtect, cierra sesión y usa «Recuperar mi contraseña» con tu Google vinculado.</p>'
          : "") +
      (isPractice
        ? '<details><summary>Probar una credencial ficticia</summary><div class="form-block">' +
          login +
          "</div></details>"
        : "") +
      (isPractice
        ? abtn("leaveDemo", "Salir de la demo", "LogOut")
        : abtn("logout", "Cerrar sesión", "LogOut"));
  const other =
    u.demo && !u.mustChange
      ? demo
      : '<aside class="privacy-card"><span class="privacy-icon">' +
        icon("LockKeyhole") +
        '</span><h3>Una cuenta, un alias</h3><p>Tus compañeros ven tu alias. Tu correo institucional y DNI se reservan para las acciones autorizadas.</p><a href="/normas.html">Consultar privacidad</a><p class="pad-top"><a href="/demo/index.html">Explorar la demo estudiantil →</a></p></aside>';
  body(
    intro(
      "CUENTA PAWTECT",
      heading,
      local
        ? "Usa la cuenta que te entregó tu colegio."
        : u.mustChange
          ? "Solo tú debes conocer la nueva contraseña."
          : "Administra tu acceso y tu vinculación institucional.",
      "CircleUserRound",
    ) +
      '<div class="two-col">' +
      main +
      "</section>" +
      other +
      "</div>",
  );
  const userInput = $("#loginForm [name=login]");
  if (userInput)
    userInput.oninput = () => {
      $("#login-hint").textContent = /^\d{8}$/.test(userInput.value.trim())
        ? "Tu usuario es " + userInput.value.trim() + "@pawtect.com."
        : "";
    };
  bindForm("#loginForm", async (b) => finish(await api("login", b)));
  bindForm("#ownerForm", async (b) => finish(await api("bootstrap", b)));
  bindForm("#pwForm", async (b) => {
    if (b.password !== b.repeat)
      throw new Error("Las dos contraseñas nuevas deben coincidir.");
    finish(await api("password", b));
  });
  if (!isPractice && !u.mustChange) await googleUI(!local);
}
export async function accountAct(a, el) {
  if (a === "demoRole") {
    const u = await api("demoRole", { role: el.dataset.val });
    finish(u);
    return true;
  }
  if (a === "logout") {
    await api("logout", {});
    location.href = pageUrl("/login.html");
    return true;
  }
  if (a === "googleSetup") {
    dialog(
      "Google institucional",
      notice(
        "El responsable del proyecto debe registrar el origen de esta web en Google Cloud, configurar el ID de cliente y dar de alta tu correo institucional. Con el padrón autorizado podrás entrar con Google. El personal también puede vincular su cuenta desde Mi cuenta.",
        "Mail",
      ) +
        '<div class="pad-top">' +
        linkBtn(
          "/guia.html#google",
          "Ver instrucciones",
          "BookOpen",
          "outline-btn",
        ) +
        "</div>",
    );
    return true;
  }
  return false;
}
