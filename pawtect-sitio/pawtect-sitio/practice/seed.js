import { samplePosts, roleNames, roles } from "../public/ui/catalog.js";
import {
  uuid,
  now,
  random,
  insert,
  seal,
  note,
  lookup,
} from "../server/core.js";
export async function seedPractice(env) {
  const scope = "demo-" + uuid(),
    school = uuid(),
    db = env.DB,
    members = {},
    ops = [
      insert(db, "schools", {
        id: school,
        scope,
        name: "Colegio de muestra · Huancayo",
        domain: "colegio.example",
      }),
    ];
  for (const key of [...Object.keys(roles), ...samplePosts.map((p) => p.key)]) {
    const sample = samplePosts.find((p) => p.key === key),
      r = sample ? "estudiante" : key;
    const u = {
      id: uuid(),
      scope,
      school,
      role: r,
      alias: sample?.alias || roleNames[r],
      avatar: sample?.avatar || (r === "estudiante" ? "menta" : "equipo"),
      identity: await seal(env, scope, {
        name: sample ? "Estudiante de ejemplo" : roleNames[r] + " (ejemplo)",
        dni: "",
        grade: "Aula de muestra",
        email: "",
        family: "",
      }),
      login_key: null,
      inst_key: null,
      google_key: null,
      password: null,
      must_change: 0,
      forum_until: 0,
      strikes: 0,
    };
    members[key] = u;
    ops.push(insert(db, "members", u));
  }
  for (const p of samplePosts) {
    const id = uuid(),
      t = now() - p.minutes * 60;
    ops.push(
      insert(db, "posts", {
        id,
        scope,
        school,
        author: members[p.key].id,
        parent: null,
        category: p.category,
        title: p.title,
        body: p.body,
        status: "Visible",
        created: t,
        sample_hearts: p.hearts,
      }),
    );
    for (const [i, [alias, body]] of p.replies.entries())
      ops.push(
        insert(db, "posts", {
          id: uuid(),
          scope,
          school,
          author: members[alias].id,
          parent: id,
          category: p.category,
          title: "",
          body,
          status: "Visible",
          created: t + (i + 1) * 240,
          sample_hearts: 0,
        }),
      );
  }
  const ticket = {
    id: "PT-" + random(8).toUpperCase(),
    scope,
    school,
    owner: members.estudiante.id,
    kind: "caso",
    category: "Exclusión",
    route: "colegio",
    priority: "Normal",
    subject: "Acompañamiento en el aula",
    body: "Ejemplo ficticio. Me gustaría conversar sobre cómo integrarme a un grupo de clase.",
    share_identity: 0,
    family: 0,
    state: "En revisión",
    assignee: members.plantel.id,
    created: now() - 86400,
    updated: now() - 7200,
  };
  ops.push(
    insert(db, "tickets", ticket),
    insert(db, "events", {
      id: uuid(),
      ticket: ticket.id,
      author: members.plantel.id,
      label: "Convivencia escolar",
      body: "Hemos leído tu caso. Puedes escribirnos aquí cuando te sientas listo.",
      internal: 0,
      created: ticket.updated,
    }),
    note(
      db,
      members.estudiante.id,
      "Tu espacio de prueba",
      "Puedes recorrer el foro y probar un caso con datos ficticios.",
      "/casos.html",
    ),
  );
  await db.batch(ops);
  const profile = {
    dni: "00000042",
    name: "Álex Rivera",
    grade: "4.º B",
    email: "alex@colegio.example",
    family: "",
  };
  await insert(db, "roster", {
    id: uuid(),
    scope,
    school,
    dni_key: await lookup(env, scope, "login", profile.dni + "@pawtect.com"),
    inst_key: await lookup(env, scope, "email", profile.email),
    identity: await seal(env, scope, profile),
  }).run();
  return members.estudiante.id;
}
