export const roles = {
  estudiante: "Estudiante",
  plantel: "Convivencia escolar",
  psicologia: "Psicología",
  equipo: "Equipo Pawtect",
  admin: "Administración",
};
export const categories = ["Experiencias", "Consejos", "Preguntas"];
export const topics = [
  "Acoso verbal",
  "Acoso físico",
  "Exclusión",
  "Ciberacoso",
  "Amenaza",
  "Bienestar emocional",
  "Otro",
];
export const priorities = ["Normal", "Alta", "Urgente"];
export const states = [
  "Recibido",
  "En revisión",
  "En acompañamiento",
  "Resuelto",
];
export const samplePosts = [
  {
    key: "luna",
    alias: "Luna Violeta",
    avatar: "luna",
    category: "Experiencias",
    title: "Hoy me animé a hablar con mi tutora",
    body: "Me daba nervios contarle lo que pasaba en el recreo. Al final me escuchó sin apurarme. ¿A alguien más le costó dar ese primer paso?",
    minutes: 24,
    hearts: 12,
    replies: [
      [
        "sol",
        "A mí también. Me ayudó escribir lo que quería decir antes de acercarme.",
      ],
      ["nube", "Gracias por contarlo. Leer esto me anima a intentarlo."],
    ],
  },
  {
    key: "sol",
    alias: "Sol de Menta",
    avatar: "sol",
    category: "Consejos",
    title: "Algo que me ayudó cuando me sentí fuera del grupo",
    body: "Una compañera me guardó un sitio en su mesa. Desde entonces intento hacer lo mismo cuando veo a alguien comiendo a solas.",
    minutes: 68,
    hearts: 8,
    replies: [["luna", "Un gesto pequeño puede cambiarte el día."]],
  },
  {
    key: "nube",
    alias: "Nube Azul",
    avatar: "nube",
    category: "Preguntas",
    title: "¿Cómo acompañan a un amigo que todavía no quiere hablar?",
    body: "Quiero que sepa que puede contar conmigo, pero también respetar su espacio. ¿Qué les ha servido a ustedes?",
    minutes: 155,
    hearts: 5,
    replies: [],
  },
];
export const roleNames = {
  estudiante: "Menta Clara",
  plantel: "Equipo de convivencia",
  psicologia: "Psicología Pawtect",
  equipo: "Protección Pawtect",
  admin: "Administración Pawtect",
};
