import { icon, esc } from "./shell.js";
const moves = [
  [
    "ayuda",
    "HandHeart",
    "Pedir ayuda",
    "Cuenta lo que pasó y consulta quién recibirá tu mensaje.",
    "lila",
  ],
  [
    "psicologia",
    "Headphones",
    "Hablar con psicología",
    "Abre una conversación privada con el equipo que te acompaña.",
    "lima",
  ],
  [
    "casos",
    "ClipboardCheck",
    "Seguir mi caso",
    "Lee las respuestas y escribe al equipo que lleva tu caso.",
    "durazno",
  ],
];
export const moods = [
  [
    "Sol",
    "Sun",
    "Con energía",
    "¿Te animas a apoyar a alguien? Comparte algo que te haya servido.",
    "Ir al foro",
    "/foro.html",
    "sun",
  ],
  [
    "Nube",
    "Cloud",
    "Más o menos",
    "Si te cuesta empezar, tenemos una frase que puedes hacer tuya.",
    "Ver cómo empezar",
    "#guias",
    "cloud",
  ],
  [
    "Lluvia",
    "CloudSun",
    "Día difícil",
    "Puedes escribir unas líneas en privado. El equipo de psicología podrá responderte.",
    "Hablar con psicología",
    "/psicologia.html",
    "rain",
  ],
];
export const guides = [
  {
    id: "empezar",
    icon: "MessageCircleHeart",
    name: "No sé cómo empezar",
    tag: "Pedir apoyo",
    summary: "Encuentra las primeras palabras para contar algo difícil.",
    steps: [
      "Elige a alguien con quien te sientas a gusto.",
      "Cuenta solo lo que quieras compartir hoy. Puedes empezar por cómo te sentiste.",
      "Di qué te ayudaría ahora, por ejemplo que te escuchen o te acompañen.",
    ],
    phrase:
      "¿Podemos hablar en privado? Me pasó algo en el cole y me ayudaría que me escucharas.",
  },
  {
    id: "amistad",
    icon: "HeartHandshake",
    name: "Quiero ayudar a un amigo",
    tag: "Entre amigos",
    summary: "Qué decir cuando alguien te cuenta que lo está pasando mal.",
    steps: [
      "Escucha a tu amigo sin presionarlo para que cuente detalles.",
      "Pregúntale cómo quiere que le acompañes.",
      "Si alguien corre peligro, busca ayuda de una persona adulta de confianza que esté cerca.",
    ],
    phrase:
      "Gracias por contármelo. ¿Quieres que te escuche o que te acompañe a pedir ayuda?",
  },
  {
    id: "pantallas",
    icon: "MessageSquareText",
    name: "Algo pasó en el chat",
    tag: "Vida digital",
    summary: "Cuida tu privacidad y decide con quién compartir lo ocurrido.",
    steps: [
      "Puedes silenciar el chat para tomar un respiro.",
      "Si decides guardar un mensaje, evita reenviarlo al grupo.",
      "Pide apoyo en privado. Puedes describir lo que pasó sin adjuntar una imagen.",
    ],
    phrase: "Pasó algo en un chat que me incomodó. ¿Podemos verlo en privado?",
  },
];
export function landing(u = {}) {
  const staff = !u.guest && u.role !== "estudiante";
  return `<section class="campus-hero"><div class="campus-copy"><div class="campus-kicker">SEGURIDAD Y BIENESTAR ESCOLAR</div><h1>Tu voz importa.<br><em>Tu seguridad también.</em></h1><p>Cuenta lo que ocurre en tu colegio, conversa con psicología o revisa la respuesta a tu caso.</p><div class="hero-links"><a class="primary-campus" href="${staff ? "/gestion.html" : "/ayuda.html"}">${staff ? "Abrir mi panel" : "Pedir ayuda en privado"}</a><a class="hero-text" href="/casos.html">Seguir mi caso ↗</a></div></div><a class="campaign-product" href="/coleccion/index.html${typeof document !== "undefined" && document.body?.dataset.mode === "demo" ? "?demo=1" : ""}" aria-label="Explorar los accesorios PAWTECT"><img src="/coleccion/assets/product-band.png" alt="Pulsera PAW BAND con placa QR"><span>Explorar accesorios ↗</span></a></section>
    <section class="portal-section"><div class="section-cap"><h2>¿Qué necesitas hoy<span>?</span></h2></div><div class="portal-grid">${moves.map(([path, i, title, copy, tone]) => `<a class="portal ${tone}" href="/${path}.html"><span class="portal-glyph">${icon(i, 30)}</span><span class="portal-copy"><strong>${title}</strong><span>${copy}</span></span><span class="portal-arrow">${icon("ArrowUpRight", 18)}</span></a>`).join("")}</div></section>
    <div class="wellness-grid"><section class="checkin"><div class="campus-kicker">${icon("HeartPulse", 15)} UN MOMENTO PARA TI</div><h2>¿Cómo llegas hoy?</h2><p>Marca cómo te sientes para ver una opción que encaje contigo. Tu elección se queda en esta pantalla.</p><div class="mood-options">${moods.map((m, i) => `<button type="button" aria-pressed="false" data-act="mood" data-val="${i}"><span class="mood-face ${m[6]}">${icon(m[1], 25)}</span>${m[2]}</button>`).join("")}</div><div id="mood-result" aria-live="polite"></div></section>
    <section class="mini-guides" id="guias"><div class="campus-kicker">${icon("BookHeart", 15)} GUÍAS BREVES</div><h2>Palabras para empezar</h2><div class="guide-links">${guides.map((g) => `<button data-act="readGuide" data-val="${g.id}"><span class="guide-glyph">${icon(g.icon, 20)}</span><span><b>${g.name}</b><small>${g.tag}</small></span>${icon("ChevronRight", 17)}</button>`).join("")}</div></section></div>
    <section class="school-strip"><span>${icon("GraduationCap", 22)} <b>Pawtect en tu colegio</b></span><p>Conoce el piloto, los accesorios con QR y los requisitos para participar.</p><a href="/colegios.html">Para colegios ${icon("ArrowUpRight", 16)}</a></section>`;
}
export function guideContent(g) {
  return (
    '<p class="dialog-desc">' +
    esc(g.summary) +
    '</p><ol class="guide-steps">' +
    g.steps.map((t) => "<li>" + esc(t) + "</li>").join("") +
    '</ol><blockquote class="phrase">' +
    esc(g.phrase) +
    '</blockquote><div class="btn-row"><button class="btn brand-btn" data-act="copyPhrase" data-val="' +
    g.id +
    '">' +
    icon("Copy", 17) +
    ' Copiar frase</button><a class="outline-btn" href="/ayuda.html">Pedir ayuda</a></div>'
  );
}
