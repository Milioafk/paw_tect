import { categories } from "../public/ui/catalog.js";
import {
  uuid,
  now,
  pick,
  str,
  fail,
  role,
  norm,
  one,
  rows,
  stmt,
  insert,
  unseal,
  limited,
  record,
  note,
  notifyOps,
} from "./core.js";
const mod = (u) => ["plantel", "equipo", "admin"].includes(u.role);
const staffView = (u, school) =>
  mod(u) && (u.school === "*" || u.school === school);
function guard(u, write = false) {
  if (u.forum_until === -1 || (write && u.forum_until > now()))
    fail(
      403,
      u.forum_until === -1
        ? "Tu acceso al foro está suspendido. Puedes seguir pidiendo ayuda y usando psicología."
        : "Tu cuenta tiene una pausa temporal para publicar. Tu ayuda privada sigue disponible.",
    );
}
async function visible(db, u, id) {
  const p = await one(
    db,
    "SELECT * FROM posts WHERE id=? AND scope=? AND school=? AND status='Visible'",
    String(id || ""),
    u.scope,
    u.school,
  );
  if (!p) fail(404, "Esta publicación ya no está disponible.");
  if (
    p.parent &&
    !(await one(
      db,
      "SELECT id FROM posts WHERE id=? AND status='Visible'",
      p.parent,
    ))
  )
    fail(404, "La conversación ya no está disponible.");
  return p;
}
function assess(raw) {
  const s = norm(raw);
  if (
    /https?:\/\/|www\.|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|(?:\b\d[ -]?){8,}\b/.test(
      s,
    )
  )
    return { level: "Revisión", reason: "Posibles datos personales o enlaces" };
  if (
    /te voy a matar|amenaza de muerte|\b(porno\w*|nudes?|xxx)\b|voy a (golpearte|apalearte)|abuso sexual|no quiero vivir/.test(
      s,
    )
  )
    return {
      level: "Grave",
      reason: "Posible amenaza, contenido explícito o relato sensible",
    };
  if (
    /\b(idiota|imbecil|estupid[oa]|huevon|puta|mierda|pendej[oa]|maricon|peguenle|peleemos|hdp|ctm)\b|te espero a la salida|te voy a pegar/.test(
      s,
    )
  )
    return {
      level: "Revisión",
      reason: "Posible agresión o relato de una experiencia",
    };
  return null;
}
const feedSelect =
  "SELECT p.id,p.category,p.title,p.body,p.created,m.alias,m.avatar,p.sample_hearts+(SELECT COUNT(*) FROM reactions r WHERE r.post=p.id AND r.kind='apoyo') AS hearts,(SELECT COUNT(*) FROM posts c WHERE c.parent=p.id AND c.status='Visible') AS comments,(SELECT COUNT(*) FROM reactions r WHERE r.post=p.id AND r.member=? AND r.kind='apoyo') AS liked,(SELECT COUNT(*) FROM reactions r WHERE r.post=p.id AND r.member=? AND r.kind='guardado') AS saved FROM posts p JOIN members m ON m.id=p.author ";
export async function forumAction(env, u, action, b) {
  const db = env.DB;
  if (action === "feed") {
    guard(u);
    const items = await rows(
      db,
      feedSelect +
        "WHERE p.scope=? AND p.school=? AND p.parent IS NULL AND p.status='Visible' ORDER BY p.created DESC,p.id LIMIT 100",
      u.id,
      u.id,
      u.scope,
      u.school,
    );
    return { items };
  }
  if (action === "comments") {
    guard(u);
    const p = await visible(db, u, b.id);
    return {
      items: await rows(
        db,
        "SELECT p.id,p.body,p.created,m.alias,m.avatar FROM posts p JOIN members m ON m.id=p.author WHERE p.parent=? AND p.status='Visible' ORDER BY p.created,p.id LIMIT 100",
        p.id,
      ),
    };
  }
  if (action === "publish") {
    role(u, "estudiante");
    guard(u, true);
    await limited(db, "post:" + u.id, 20, 600);
    const body = str(b.body, 2, 1800, "Tu texto"),
      parent = b.parent ? await visible(db, u, b.parent) : null;
    if (parent?.parent) fail(400, "Responde a la publicación principal.");
    const title = parent ? "" : str(b.title, 3, 110, "El título"),
      category = parent ? parent.category : pick(b.category, categories);
    const check = assess(title + " " + body),
      id = uuid(),
      ops = [
        insert(db, "posts", {
          id,
          scope: u.scope,
          school: u.school,
          author: u.id,
          parent: parent?.id || null,
          category,
          title,
          body,
          status: check ? "En revisión" : "Visible",
          created: now(),
        }),
      ];
    if (check) {
      ops.push(
        insert(db, "reviews", {
          id: uuid(),
          scope: u.scope,
          school: u.school,
          post: id,
          reporter: "filtro",
          reason: check.reason,
          level: check.level,
          state: "Pendiente",
          created: now(),
        }),
      );
    } else if (parent && parent.author !== u.id)
      ops.push(
        note(
          db,
          parent.author,
          "Nueva respuesta",
          "Alguien respondió a tu publicación.",
          "/foro.html?post=" + parent.id,
        ),
      );
    await db.batch(ops);
    return { id, held: !!check };
  }
  if (action === "reaction") {
    guard(u, true);
    const p = await visible(db, u, b.id),
      kind = pick(b.kind, ["apoyo", "guardado"]);
    if (b.on)
      await stmt(
        db,
        "INSERT INTO reactions(id,member,post,kind) VALUES(?,?,?,?) ON CONFLICT(member,post,kind) DO NOTHING",
        uuid(),
        u.id,
        p.id,
        kind,
      ).run();
    else
      await stmt(
        db,
        "DELETE FROM reactions WHERE member=? AND post=? AND kind=?",
        u.id,
        p.id,
        kind,
      ).run();
    return { ok: true };
  }
  if (action === "flag") {
    guard(u);
    await limited(db, "flag:" + u.id, 12, 600);
    const p = await visible(db, u, b.id),
      reason = str(b.reason, 6, 400, "El motivo");
    await stmt(
      db,
      "INSERT INTO reviews(id,scope,school,post,reporter,reason,level,state,created) VALUES(?,?,?,?,?,?,'Revisión','Pendiente',?) ON CONFLICT(post,reporter) DO NOTHING",
      uuid(),
      u.scope,
      u.school,
      p.id,
      u.id,
      reason,
      now(),
    ).run();
    return { ok: true };
  }
  if (!mod(u))
    fail(403, "Solo el equipo de moderación puede revisar incidentes.");
  if (action === "reviews") {
    return {
      items: await rows(
        db,
        "SELECT r.id,r.reason,r.level,r.state,r.decision,r.created,p.title,p.body,m.alias FROM reviews r JOIN posts p ON p.id=r.post JOIN members m ON m.id=p.author WHERE r.scope=? AND (r.school=? OR ?='*') ORDER BY CASE r.state WHEN 'Pendiente' THEN 0 ELSE 1 END,r.created DESC LIMIT 100",
        u.scope,
        u.school,
        u.school,
      ),
    };
  }
  const r = await one(
    db,
    "SELECT r.*,p.author FROM reviews r JOIN posts p ON p.id=r.post WHERE r.id=? AND r.scope=?",
    b.id || "",
    u.scope,
  );
  if (!r || !staffView(u, r.school)) fail(404, "No se encontró ese incidente.");
  if (action === "forumIdentity") {
    if (
      r.state !== "Resuelta" ||
      r.decision !== "Expulsión" ||
      r.level !== "Grave"
    )
      fail(403, "Se requiere una infracción grave confirmada.");
    const reason = str(b.reason, 15, 450, "La justificación");
    await record(
      db,
      u,
      r.id,
      "Identificación por infracción grave",
      reason,
    ).run();
    const person = await one(
      db,
      "SELECT identity FROM members WHERE id=?",
      r.author,
    );
    const info = await unseal(env, u.scope, person.identity);
    return {
      name: info.name,
      dni: info.dni,
      grade: info.grade,
      email: info.email,
    };
  }
  if (action === "moderate") {
    if (r.state !== "Pendiente")
      fail(409, "El equipo ya resolvió este incidente.");
    let decision = pick(b.decision, [
      "Aprobar",
      "Retirar",
      "Advertencia",
      "Pausa de 24 h",
      "Pausa de 7 días",
      "Expulsión",
    ]);
    const level = pick(b.level, ["Revisión", "Grave"]),
      reason = str(b.reason, 8, 450, "La justificación");
    if (decision === "Expulsión" && level !== "Grave")
      fail(400, "Confirma la gravedad y documenta el motivo para expulsar.");
    const member = await one(
      db,
      "SELECT strikes,forum_until FROM members WHERE id=?",
      r.author,
    );
    if (decision === "Advertencia" && member.strikes >= 2)
      decision = "Pausa de 24 h";
    const delta = { "Pausa de 24 h": 86400, "Pausa de 7 días": 604800 }[
      decision
    ];
    const until =
      decision === "Expulsión" || member.forum_until === -1
        ? -1
        : Math.max(member.forum_until, delta ? now() + delta : 0);
    const sanctioned = !["Aprobar", "Retirar"].includes(decision);
    // The primary key on the audit entry makes concurrent decisions mutually exclusive.
    const ops = [
      stmt(
        db,
        "INSERT INTO audit(id,scope,actor,object,action,reason,created) VALUES ((SELECT 'mod-' || MIN(id) FROM reviews WHERE post=? AND state='Pendiente' AND EXISTS (SELECT id FROM reviews WHERE id=? AND state='Pendiente')),?,?,?,?,?,?)",
        r.post,
        r.id,
        u.scope,
        u.id,
        r.id,
        "Resolución del foro",
        decision + " · " + reason,
        now(),
      ),
      stmt(
        db,
        "UPDATE reviews SET state='Resuelta',decision=?,level=? WHERE post=? AND state='Pendiente'",
        decision,
        level,
        r.post,
      ),
      stmt(
        db,
        "UPDATE posts SET status=? WHERE id=?",
        decision === "Aprobar" ? "Visible" : "Retirada",
        r.post,
      ),
    ];
    if (sanctioned)
      ops.push(
        stmt(
          db,
          "UPDATE members SET strikes=strikes+1,forum_until=CASE WHEN forum_until=-1 OR ?=-1 THEN -1 WHEN forum_until>? THEN forum_until ELSE ? END WHERE id=?",
          until,
          until,
          until,
          r.author,
        ),
      );
    ops.push(
      note(
        db,
        r.author,
        "Revisión de tu publicación",
        decision + " · " + reason,
        "/foro.html",
      ),
    );
    if (decision === "Expulsión") {
      const schoolTeam = await rows(
        db,
        "SELECT id,identity FROM members WHERE scope=? AND school=? AND role='plantel'",
        u.scope,
        r.school,
      );
      ops.push(
        ...(await notifyOps(
          env,
          u.scope,
          schoolTeam,
          "Infracción grave confirmada",
          "Revisa el incidente cerrado en Moderación.",
          "/gestion.html?tab=moderacion",
        )),
      );
    }
    await db.batch(ops);
    return { decision };
  }
  fail(404, "Acción del foro desconocida.");
}
