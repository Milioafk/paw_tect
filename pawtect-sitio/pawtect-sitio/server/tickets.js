import { topics, priorities, states, roles } from "../public/ui/catalog.js";
import {
  uuid,
  random,
  now,
  str,
  pick,
  fail,
  role,
  norm,
  lookup,
  one,
  rows,
  stmt,
  insert,
  unseal,
  note,
  record,
  recipients,
  notifyOps,
  limited,
} from "./core.js";
const team = (u) => ["plantel", "psicologia", "equipo"].includes(u.role);
function deskRoute(u) {
  return { plantel: "colegio", psicologia: "psicologia", equipo: "externa" }[
    u.role
  ];
}
function handles(u, t) {
  return (
    team(u) &&
    t.route === deskRoute(u) &&
    (u.school === "*" || u.school === t.school)
  );
}
async function get(env, u, id) {
  const t = await one(
    env.DB,
    "SELECT * FROM tickets WHERE id=? AND scope=?",
    String(id || "").trim(),
    u.scope,
  );
  if (!t || !(t.owner === u.id || handles(u, t)))
    fail(404, "No se encontró el caso en tu espacio.");
  return t;
}
export async function listTickets(env, u) {
  const common = `SELECT t.id,t.kind,t.subject,t.category,t.priority,t.state,t.route,t.created,t.updated,
    last_event.created AS last_at
    FROM tickets t LEFT JOIN events last_event ON last_event.id = (
      SELECT e.id FROM events e WHERE e.ticket=t.id AND e.internal=0
      ORDER BY e.created DESC,e.id DESC LIMIT 1
    ) WHERE t.scope=? AND `;
  const args = [u.scope];
  let q;
  if (team(u)) {
    q = "(t.owner=? OR (t.route=? AND (t.school=? OR ?='*')))";
    args.push(u.id, deskRoute(u), u.school, u.school);
  } else {
    q = "t.owner=?";
    args.push(u.id);
  }
  return rows(
    env.DB,
    common +
      q +
      " ORDER BY CASE t.priority WHEN 'Urgente' THEN 0 WHEN 'Alta' THEN 1 ELSE 2 END, t.updated DESC,t.id LIMIT 250",
    ...args,
  );
}
export async function describe(env, u, id) {
  const t = await get(env, u, id),
    db = env.DB,
    staff = handles(u, t);
  const log = await rows(
    db,
    "SELECT id,label,body,internal,created FROM events WHERE ticket=? AND (internal=0 OR ?=1) ORDER BY created,id",
    t.id,
    staff ? 1 : 0,
  );
  const files = await rows(
    db,
    "SELECT id,name,size FROM files WHERE ticket=?",
    t.id,
  );
  const owner = await one(db, "SELECT alias FROM members WHERE id=?", t.owner);
  const assigned = t.assignee
    ? await one(db, "SELECT alias FROM members WHERE id=?", t.assignee)
    : null;
  const { scope, school, owner: privateId, assignee, ...safe } = t;
  return {
    ...safe,
    alias: owner.alias,
    assigned: assigned?.alias || "",
    staff,
    canIdentify: staff && (!!t.share_identity || t.priority === "Urgente"),
    events: log,
    files,
  };
}
function priorityFor(raw, body, category) {
  const text = norm(body);
  if (
    raw === "Urgente" ||
    /peligro inmediato|amenaza de muerte|me van a matar|arma de fuego|no quiero vivir|abuso sexual/.test(
      text,
    )
  )
    return "Urgente";
  if (raw === "Alta" || ["Amenaza", "Acoso físico"].includes(category))
    return "Alta";
  return "Normal";
}
async function checkedFiles(parts) {
  if (
    parts.length > 3 ||
    parts.reduce((n, f) => n + f.size, 0) > 3 * 1024 * 1024
  )
    fail(400, "Adjunta hasta tres archivos con un total máximo de 3 MB.");
  const checked = [];
  for (const f of parts) {
    if (typeof f.arrayBuffer !== "function" || f.size === 0)
      fail(400, "El archivo está vacío.");
    const body = new Uint8Array(await f.arrayBuffer());
    const sig = Array.from(body.slice(0, 8)).join(",");
    const type = sig.startsWith("137,80,78,71,13,10,26,10")
      ? "image/png"
      : sig.startsWith("255,216,255")
        ? "image/jpeg"
        : sig.startsWith("37,80,68,70,45")
          ? "application/pdf"
          : null;
    if (!type || f.type !== type)
      fail(400, "Usa archivos JPG, PNG o PDF válidos.");
    const ext = {
      "image/png": ".png",
      "image/jpeg": ".jpg",
      "application/pdf": ".pdf",
    }[type];
    checked.push({
      body,
      mime: type,
      size: f.size,
      name: "Adjunto " + (checked.length + 1) + ext,
    });
  }
  return checked;
}
export async function newTicket(env, u, b, parts) {
  role(u, "estudiante");
  await limited(env.DB, "cases:" + u.id, 16, 3600);
  const kind = pick(b.kind, ["caso", "psicologia"]),
    actor =
      kind === "psicologia"
        ? "psicologia"
        : pick(b.actor, ["estudiante", "docente", "directivo", "otro"]);
  const subject =
      kind === "psicologia"
        ? "Consulta de psicología"
        : str(b.subject, 3, 100, "El título"),
    body = str(b.body, 10, 5000, "Tu mensaje");
  const category =
      kind === "psicologia" ? "Bienestar emocional" : pick(b.category, topics),
    priority = priorityFor(
      pick(b.priority || "Normal", priorities),
      body,
      category,
    );
  const route =
    actor === "psicologia"
      ? "psicologia"
      : ["docente", "directivo"].includes(actor)
        ? "externa"
        : "colegio";
  if (!b.ack) fail(400, "Confirma que conoces quién podrá leer el mensaje.");
  let familyAddress = "";
  if (b.family) {
    const info = await unseal(env, u.scope, u.identity);
    familyAddress = info.family || "";
    if (!familyAddress)
      fail(400, "Tu cuenta aún no tiene un correo familiar autorizado.");
  }
  const requestId = b.requestId
    ? str(b.requestId, 36, 36, "El identificador del formulario")
    : uuid();
  const id =
    "PT-" +
    (await lookup(env, u.scope, "case", u.id + "|" + requestId))
      .slice(0, 14)
      .toUpperCase();
  const existing = () =>
    one(
      env.DB,
      "SELECT id,route,priority FROM tickets WHERE scope=? AND owner=? AND id=?",
      u.scope,
      u.id,
      id,
    );
  const prior = await existing();
  if (prior) return prior;
  const t = {
    id,
    scope: u.scope,
    school: u.school,
    owner: u.id,
    kind,
    category,
    route,
    priority,
    subject,
    body,
    share_identity: b.share ? 1 : 0,
    family: b.family ? 1 : 0,
    state: "Recibido",
    assignee: null,
    created: now(),
    updated: now(),
  };
  const files = await checkedFiles(parts);
  if (files.length && !env.BUCKET)
    fail(503, "Los adjuntos no están disponibles en este momento.");
  const ops = [
    insert(env.DB, "tickets", t),
    record(env.DB, u, t.id, "Ingreso de consulta", actor),
  ];
  const rec = await recipients(env.DB, t);
  if (!rec.length && u.scope === "real")
    fail(
      409,
      "El colegio aún debe designar a una persona responsable de esta ruta. Puedes usar el canal oficial de SíseVe.",
    );
  ops.push(
    ...(await notifyOps(
      env,
      u.scope,
      rec,
      t.priority === "Urgente"
        ? "Caso urgente por revisar"
        : "Nueva consulta asignada",
      "Revisa la bandeja privada de tu equipo.",
      "/gestion.html",
      familyAddress,
    )),
  );
  const keys = [];
  try {
    for (const f of files) {
      const id = uuid(),
        key = u.scope + "/" + t.id + "/" + id;
      await env.BUCKET.put(key, f.body);
      keys.push(key);
      ops.push(
        insert(env.DB, "files", {
          id,
          ticket: t.id,
          storage_key: key,
          name: f.name,
          mime: f.mime,
          size: f.size,
        }),
      );
    }
    await env.DB.batch(ops);
  } catch (e) {
    await Promise.allSettled(keys.map((k) => env.BUCKET.delete(k)));
    const retry = await existing();
    if (retry) return retry;
    throw e;
  }
  return { id: t.id, route, priority };
}
export async function ticketAction(env, u, action, b) {
  if (action === "tickets") return { items: await listTickets(env, u) };
  if (action === "lastMessage") {
    const t = await get(env, u, b.id);
    const event = await one(
      env.DB,
      "SELECT substr(body,1,161) AS excerpt,created,label,author FROM events WHERE ticket=? AND internal=0 ORDER BY created DESC,id DESC LIMIT 1",
      t.id,
    );
    if (!event) return { message: null };
    const letters = Array.from(event.excerpt);
    return {
      message: {
        text:
          letters.slice(0, 160).join("") + (letters.length > 160 ? "…" : ""),
        at: event.created,
        from: event.author === u.id ? "Tú" : event.label,
      },
    };
  }
  if (action === "ticket") return describe(env, u, b.id);
  if (action === "file") {
    const f = await one(env.DB, "SELECT * FROM files WHERE id=?", b.id || "");
    if (!f) fail(404, "No se encontró el archivo.");
    const t = await get(env, u, f.ticket);
    const data = await env.BUCKET.get(f.storage_key);
    if (!data) fail(404, "El archivo no está disponible.");
    await record(env.DB, u, t.id, "Descarga de adjunto", f.id).run();
    return new Response(data.body, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": 'attachment; filename="' + f.name + '"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  }
  const t = await get(env, u, b.id),
    db = env.DB,
    staff = handles(u, t);
  if (action === "identify") {
    if (!staff || (!t.share_identity && t.priority !== "Urgente"))
      fail(
        403,
        "Esta apertura requiere autorización del estudiante o una valoración urgente.",
      );
    const reason = str(b.reason, 15, 500, "El motivo de acceso");
    const owner = await one(
      db,
      "SELECT identity FROM members WHERE id=?",
      t.owner,
    );
    await db.batch([
      record(db, u, t.id, "Consulta de identidad", reason),
      note(
        db,
        t.owner,
        "Acceso a tu identidad",
        "El equipo registró una consulta de identidad para tu caso.",
        "/casos.html?id=" + t.id,
      ),
    ]);
    const info = await unseal(env, u.scope, owner.identity);
    return {
      name: info.name,
      grade: info.grade,
      email: info.email,
      dni: info.dni,
    };
  }
  if (action === "export") {
    const d = await describe(env, u, t.id);
    await record(
      db,
      u,
      t.id,
      "Copia de informe",
      "Copia de seguimiento sin identidad ni notas internas",
    ).run();
    return {
      ...d,
      events: d.events.filter((e) => !e.internal),
      files: [],
      body: d.body,
    };
  }
  if (action === "event") {
    const body = str(b.body, 2, 3000, "El mensaje"),
      internal = !!b.internal && staff;
    if (b.internal && !staff)
      fail(403, "Solo el equipo puede añadir notas internas.");
    const ops = [
      insert(db, "events", {
        id: uuid(),
        ticket: t.id,
        author: u.id,
        label: staff ? roles[u.role] : "Estudiante",
        body,
        internal: internal ? 1 : 0,
        created: now(),
      }),
      stmt(db, "UPDATE tickets SET updated=? WHERE id=?", now(), t.id),
    ];
    if (!internal) {
      const rec = staff
        ? [await one(db, "SELECT id,identity FROM members WHERE id=?", t.owner)]
        : await recipients(db, t);
      ops.push(
        ...(await notifyOps(
          env,
          u.scope,
          rec,
          "Nuevo mensaje privado",
          "Tienes una actualización en tu consulta.",
          (staff ? "/casos.html?id=" : "/gestion.html?id=") + t.id,
        )),
      );
    }
    await db.batch(ops);
    return { ok: true };
  }
  if (action === "manage") {
    if (!staff) fail(403, "Esta consulta está a cargo de otro equipo.");
    const state = pick(b.state, states),
      priority = pick(b.priority, priorities),
      reason = str(b.reason, 5, 500, "La nota de seguimiento");
    await db.batch([
      stmt(
        db,
        "UPDATE tickets SET state=?,priority=?,assignee=?,updated=? WHERE id=?",
        state,
        priority,
        u.id,
        now(),
        t.id,
      ),
      record(
        db,
        u,
        t.id,
        "Gestión de caso",
        state + " · " + priority + " · " + reason,
      ),
      insert(db, "events", {
        id: uuid(),
        ticket: t.id,
        author: u.id,
        label: roles[u.role],
        body: state + " · " + reason,
        internal: 0,
        created: now(),
      }),
      ...(await notifyOps(
        env,
        u.scope,
        [await one(db, "SELECT id,identity FROM members WHERE id=?", t.owner)],
        "Cambió el estado de tu caso",
        "Consulta los detalles en tu espacio.",
        "/casos.html?id=" + t.id,
      )),
    ]);
    return { ok: true };
  }
  fail(404, "Acción de caso desconocida.");
}
