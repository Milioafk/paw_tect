import {
  uuid,
  random,
  mail,
  str,
  lookup,
  seal,
  unseal,
  fail,
  role,
  one,
  rows,
  stmt,
  limited,
  record,
} from "./core.js";

const dniOf = (value) => {
  if (!/^\d{8}$/.test(String(value ?? "")))
    fail(400, "El DNI debe tener ocho dígitos.");
  return String(value);
};
export async function rosterAction(env, u, action, body) {
  role(u, "admin", "plantel");
  const db = env.DB;
  const school = await one(
    db,
    "SELECT id,domain FROM schools WHERE scope=? AND id=?",
    u.scope,
    u.role === "plantel" ? u.school : body.school || "",
  );
  if (!school || (body.school && school.id !== body.school))
    fail(403, "Selecciona un colegio a tu cargo.");
  if (action === "rosterLookup") {
    await limited(db, "padron:" + u.id, 45, 900);
    const key = await lookup(
      env,
      u.scope,
      "login",
      dniOf(body.dni) + "@pawtect.com",
    );
    const entry =
      (await one(
        db,
        "SELECT id,identity FROM roster WHERE scope=? AND school=? AND dni_key=?",
        u.scope,
        school.id,
        key,
      )) ||
      (await one(
        db,
        "SELECT id,identity FROM members WHERE scope=? AND school=? AND login_key=?",
        u.scope,
        school.id,
        key,
      ));
    if (!entry)
      fail(404, "Este DNI todavía no figura en el padrón de este colegio.");
    const data = await unseal(env, u.scope, entry.identity);
    await record(
      db,
      u,
      entry.id,
      "Consulta de padrón",
      "Preparación de cuenta institucional",
    ).run();
    return { name: data.name, grade: data.grade, email: data.email };
  }
  if (!Array.isArray(body.rows) || !body.rows.length || body.rows.length > 50)
    fail(400, "Importa de 1 a 50 estudiantes por archivo.");
  const seenDni = new Set(),
    seenMail = new Set(),
    prepared = [];
  for (const [index, row] of body.rows.entries()) {
    const dni = dniOf(row?.dni),
      email = mail(row?.correo),
      name = str(row?.nombre, 2, 90, "El nombre de la fila " + (index + 2));
    const grade = str(row?.grado || "", 0, 50, "El grado");
    if (email.split("@")[1] !== school.domain)
      fail(
        400,
        "La fila " +
          (index + 2) +
          " necesita un correo de @" +
          school.domain +
          ".",
      );
    if (seenDni.has(dni) || seenMail.has(email))
      fail(400, "Hay un DNI o correo repetido en la fila " + (index + 2) + ".");
    seenDni.add(dni);
    seenMail.add(email);
    const dk = await lookup(env, u.scope, "login", dni + "@pawtect.com"),
      ek = await lookup(env, u.scope, "email", email);
    prepared.push({
      dk,
      ek,
      row: index + 2,
      identity: await seal(env, u.scope, {
        dni,
        email,
        name,
        grade,
        family: "",
      }),
    });
  }
  const byDni = new Map(prepared.map((r) => [r.dk, r])),
    byEmail = new Map(prepared.map((r) => [r.ek, r]));
  // Each pair of lists stays below the bind-parameter limit on both databases.
  for (let start = 0; start < prepared.length; start += 24) {
    const chunk = prepared.slice(start, start + 24),
      markers = chunk.map(() => "?").join(",");
    const args = [
      u.scope,
      ...chunk.map((r) => r.dk),
      ...chunk.map((r) => r.ek),
    ];
    const enrolled = await rows(
      db,
      `SELECT school,dni_key AS dk,inst_key AS ek FROM roster WHERE scope=? AND (dni_key IN (${markers}) OR inst_key IN (${markers}))`,
      ...args,
    );
    const members = await rows(
      db,
      `SELECT school,login_key AS dk,inst_key AS ek,role FROM members WHERE scope=? AND (login_key IN (${markers}) OR inst_key IN (${markers}))`,
      ...args,
    );
    for (const record of [...enrolled, ...members]) {
      const incoming = byDni.get(record.dk) || byEmail.get(record.ek);
      if (
        !incoming ||
        incoming.dk !== record.dk ||
        incoming.ek !== record.ek ||
        record.school !== school.id ||
        (record.role && record.role !== "estudiante")
      )
        fail(
          409,
          "Revisa el DNI y el correo de la fila " +
            incoming?.row +
            ". Ya hay un registro incompatible.",
        );
    }
  }
  // A conflicting concurrent import fails the entire batch, including its audit entry.
  const ops = prepared.map((r) =>
    stmt(
      db,
      "INSERT INTO roster(id,scope,school,dni_key,inst_key,identity) VALUES(?,?,?,?,?,?) ON CONFLICT(scope,dni_key) DO UPDATE SET identity=CASE WHEN roster.school=excluded.school AND roster.inst_key=excluded.inst_key THEN excluded.identity ELSE NULL END",
      uuid(),
      u.scope,
      school.id,
      r.dk,
      r.ek,
      r.identity,
    ),
  );
  ops.push(
    record(
      db,
      u,
      school.id,
      "Importación de padrón",
      body.rows.length + " fichas de estudiantes",
    ),
  );
  try {
    await db.batch(ops);
  } catch (e) {
    if (
      /unique|constraint|not.null/i.test(
        String(e.message) + " " + String(e.cause?.message),
      )
    )
      fail(
        409,
        "El padrón cambió. Vuelve a revisar el archivo antes de importarlo.",
      );
    throw e;
  }
  return { count: body.rows.length };
}

export async function authorizeFirstGoogle(env, g, key, emailKey) {
  const db = env.DB;
  const candidate = await one(
    db,
    "SELECT * FROM members WHERE scope='real' AND inst_key=?",
    emailKey,
  );
  if (candidate)
    return candidate.role === "estudiante" &&
      (!candidate.google_key || candidate.google_key === key)
      ? candidate
      : null;
  const entry = await one(
    db,
    "SELECT r.*,s.domain FROM roster r JOIN schools s ON s.id=r.school AND s.scope=r.scope WHERE r.scope='real' AND r.inst_key=?",
    emailKey,
  );
  if (!entry || entry.domain !== g.hd || g.email.split("@")[1] !== entry.domain)
    return null;
  const p = await unseal(env, "real", entry.identity);
  const identity = await seal(env, "real", { ...p, googleName: g.name });
  await stmt(
    db,
    "INSERT INTO members(id,scope,school,role,alias,avatar,identity,login_key,inst_key,google_key) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
    uuid(),
    "real",
    entry.school,
    "estudiante",
    "Nube " + random(4),
    "nube",
    identity,
    entry.dni_key,
    emailKey,
    key,
  ).run();
  const added = await one(
    db,
    "SELECT * FROM members WHERE scope='real' AND inst_key=? AND school=? AND login_key=?",
    emailKey,
    entry.school,
    entry.dni_key,
  );
  return added?.role === "estudiante" &&
    (!added.google_key || added.google_key === key)
    ? added
    : null;
}
