import { rosterAction } from "./roster.js";
import {
  uuid,
  random,
  same,
  now,
  sha,
  str,
  mail,
  pick,
  fail,
  role,
  json,
  one,
  rows,
  stmt,
  insert,
  unseal,
  seal,
  limited,
  record,
  notifyOps,
  deliver,
} from "./core.js";
import {
  current,
  authAction,
  createSchool,
  createMember,
  renewInitial,
} from "./accounts.js";
import { newTicket, ticketAction } from "./tickets.js";
import { forumAction } from "./forum.js";
const auth = [
  "session",
  "login",
  "logout",
  "googleConfig",
  "googleLogin",
  "googleLink",
  "googleRecover",
  "demoRole",
  "password",
  "bootstrap",
];
const forum = [
  "feed",
  "comments",
  "publish",
  "reaction",
  "flag",
  "reviews",
  "moderate",
  "forumIdentity",
];
const cases = [
  "tickets",
  "lastMessage",
  "ticket",
  "event",
  "identify",
  "manage",
  "export",
  "file",
];
const reads = new Set([
  "feed",
  "comments",
  "tickets",
  "lastMessage",
  "ticket",
  "file",
  "notices",
  "reviews",
  "certs",
  "schools",
  "audit",
  "profile",
  "mailStatus",
  "googleConfig",
]);
async function perform(req, env, ctx) {
  const referer = req.headers.get("referer");
  if (
    !env.LOCAL_PRACTICE &&
    referer &&
    new URL(referer, req.url).pathname.startsWith("/demo/")
  )
    fail(403, "La práctica funciona solo en tu navegador.");
  if (!env.DB) fail(503, "La base de datos todavía no está conectada.");
  const url = new URL(req.url),
    action = url.searchParams.get("action") || "";
  if (req.method === "POST") {
    const origin = req.headers.get("origin");
    if (!env.LOCAL_PRACTICE && (!origin || origin !== url.origin))
      fail(403, "Abre el formulario desde el sitio de Pawtect.");
  } else if (req.method !== "GET" || !reads.has(action))
    fail(405, "Usa el formulario correspondiente para esta acción.");
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > (action === "newTicket" ? 3.2 * 1024 * 1024 : 32768))
    fail(413, "El contenido supera el tamaño permitido.");
  let b = Object.fromEntries(url.searchParams),
    parts = [];
  if (req.method === "POST") {
    if (action === "newTicket") {
      const form = await req.formData();
      try {
        b = JSON.parse(form.get("data") || "{}");
      } catch {
        fail(400, "Formulario inválido.");
      }
      parts = form.getAll("files");
    } else {
      const body = await req.text();
      if (body.length > 32768) fail(413, "El contenido es demasiado largo.");
      try {
        b = JSON.parse(body || "{}");
      } catch {
        fail(400, "Formulario inválido.");
      }
    }
  }
  const u = await current(env, req),
    client = await sha(
      req.headers.get("cf-connecting-ip") ||
        req.headers.get("x-vercel-forwarded-for") ||
        "local",
    );
  if (auth.includes(action))
    return await authAction({ req, env, u, client }, action, b);
  const publicCertificate =
    !u &&
    !env.LOCAL_PRACTICE &&
    (action === "certLookup" ||
      (action === "certApply" && env.PAWTECT_PILOT_OPEN === "1"));
  if (!u && !publicCertificate) fail(401, "Tu sesión terminó. Entra de nuevo.");
  if (u?.must_change)
    fail(403, "Primero, cambia tu clave temporal en Mi cuenta.");
  let result;
  if (action === "newTicket") result = await newTicket(env, u, b, parts);
  else if (cases.includes(action))
    result = await ticketAction(env, u, action, b);
  else if (forum.includes(action))
    result = await forumAction(env, u, action, b);
  else if (action === "notices")
    result = {
      items: await rows(
        env.DB,
        "SELECT id,title,detail,url,seen,created FROM notifications WHERE member=? ORDER BY created DESC,id LIMIT 80",
        u.id,
      ),
    };
  else if (action === "markSeen") {
    await stmt(
      env.DB,
      "UPDATE notifications SET seen=1 WHERE member=?",
      u.id,
    ).run();
    result = { ok: true };
  } else if (action === "profile") {
    const p = await unseal(env, u.scope, u.identity);
    result = {
      name: p.name,
      googleName: p.googleName || "",
      email: p.email,
      grade: p.grade,
      linked: !!u.google_key,
      hasFamily: !!p.family,
      hasPassword: !!u.password,
    };
  } else if (action === "schools") {
    role(u, "plantel", "admin");
    result = {
      items: await rows(
        env.DB,
        "SELECT id,name,domain FROM schools WHERE scope=? AND (id=? OR ?='admin') ORDER BY name",
        u.scope,
        u.school,
        u.role,
      ),
    };
  } else if (action === "schoolAdd") result = await createSchool(env, u, b);
  else if (action === "memberAdd") result = await createMember(env, u, b);
  else if (["rosterImport", "rosterLookup"].includes(action))
    result = await rosterAction(env, u, action, b);
  else if (action === "renewInitial") result = await renewInitial(env, u, b);
  else if (action === "certApply") {
    if (u?.role === "estudiante" && u.scope === "real")
      fail(403, "La solicitud debe enviarla el plantel o el equipo Pawtect.");
    const scope = u?.scope || "real";
    await limited(env.DB, "cert:" + (u?.id || client), 8, 86400);
    const school = str(b.school, 3, 100, "El colegio"),
      contact = mail(b.email),
      name = str(b.name, 3, 80, "Tu nombre"),
      size = Number(b.size);
    if (!Number.isInteger(size) || size < 1 || size > 50000 || !b.ack)
      fail(
        400,
        "Revisa el número de estudiantes y confirma tu representación.",
      );
    const plan = pick(b.plan, ["Piloto gratuito", "Base", "Premium"]),
      id = "CE-" + uuid().slice(0, 12).toUpperCase(),
      trackingKey = random(18);
    const admins = await rows(
      env.DB,
      "SELECT id,identity FROM members WHERE scope=? AND role='admin'",
      scope,
    );
    if (scope === "real" && !admins.length)
      fail(409, "La recepción de colegios está pendiente de activación.");
    await env.DB.batch([
      insert(env.DB, "certifications", {
        id,
        scope,
        school,
        name: await seal(env, scope, name),
        contact: await seal(env, scope, contact),
        size,
        plan,
        requester: u?.id || null,
        status_key: await sha(trackingKey),
        state: "Recibida",
        created: now(),
      }),
      ...(await notifyOps(
        env,
        scope,
        admins,
        "Solicitud de colegio",
        "Hay una nueva solicitud de certificación.",
        "/gestion.html?tab=colegios",
      )),
    ]);
    result = { id, trackingKey };
  } else if (action === "certLookup") {
    await limited(env.DB, "cert-lookup:" + client, 40, 900);
    const id = str(b.id, 3, 32, "El código").toUpperCase(),
      c = await one(
        env.DB,
        "SELECT id,scope,school,requester,status_key,issued_at,state,plan,created FROM certifications WHERE id=?",
        id,
      );
    const byAccount =
      c &&
      u &&
      u.scope === c.scope &&
      (u.role === "admin" || u.id === c.requester);
    if (
      !c ||
      c.scope !== (u?.scope || "real") ||
      (!byAccount &&
        (!b.key || !same(await sha(String(b.key).trim()), c.status_key)))
    )
      fail(404, "Revisa el código y la clave de consulta de tu solicitud.");
    result = {
      id: c.id,
      school: c.school,
      issued: c.issued_at,
      state: c.state,
      plan: c.plan,
      created: c.created,
    };
  } else if (action === "certs") {
    role(u, "admin");
    const items = await rows(
      env.DB,
      "SELECT * FROM certifications WHERE scope=? ORDER BY created DESC",
      u.scope,
    );
    for (const c of items) {
      c.name = await unseal(env, u.scope, c.name);
      c.contact = await unseal(env, u.scope, c.contact);
      delete c.scope;
      delete c.status_key;
      delete c.requester;
    }
    result = { items };
  } else if (action === "certUpdate") {
    role(u, "admin");
    const state = pick(b.state, [
      "Recibida",
      "En evaluación",
      "Aprobada",
      "Observada",
    ]);
    const c = await one(
      env.DB,
      "SELECT id,contact FROM certifications WHERE scope=? AND id=?",
      u.scope,
      b.id || "",
    );
    if (!c) fail(404, "Solicitud no encontrada.");
    await env.DB.batch([
      stmt(
        env.DB,
        "UPDATE certifications SET state=?,issued_at=CASE WHEN ?='Aprobada' THEN CASE WHEN issued_at>0 THEN issued_at ELSE ? END ELSE 0 END WHERE id=?",
        state,
        state,
        now(),
        c.id,
      ),
      record(env.DB, u, c.id, "Certificación", state),
      ...(await notifyOps(
        env,
        u.scope,
        [],
        "",
        "",
        "",
        await unseal(env, u.scope, c.contact),
      )),
    ]);
    result = { ok: true };
  } else if (action === "audit") {
    role(u, "admin");
    result = {
      items: await rows(
        env.DB,
        "SELECT a.action,a.reason,a.object,a.created,m.alias FROM audit a JOIN members m ON m.id=a.actor WHERE a.scope=? ORDER BY a.created DESC LIMIT 100",
        u.scope,
      ),
    };
  } else if (action === "mailStatus") {
    role(u, "admin");
    result = {
      configured: !!(env.EMAIL_FROM && env.RESEND_API_KEY),
      review: Number(
        (
          await one(
            env.DB,
            "SELECT COUNT(*) AS n FROM outbox WHERE scope=? AND state='Revisar'",
            u.scope,
          )
        ).n,
      ),
      pending: Number(
        (
          await one(
            env.DB,
            "SELECT COUNT(*) AS n FROM outbox WHERE scope=? AND state='Pendiente'",
            u.scope,
          )
        ).n,
      ),
      sent: Number(
        (
          await one(
            env.DB,
            "SELECT COUNT(*) AS n FROM outbox WHERE scope=? AND state='Enviado'",
            u.scope,
          )
        ).n,
      ),
    };
  } else if (action === "retryMail") {
    role(u, "admin");
    result =
      u.scope === "real" ? await deliver(env) : { sent: 0, configured: false };
  } else fail(404, "La acción solicitada no existe.");
  if (
    (u?.scope === "real" || publicCertificate) &&
    [
      "newTicket",
      "manage",
      "event",
      "moderate",
      "certApply",
      "certUpdate",
    ].includes(action) &&
    env.RESEND_API_KEY
  ) {
    const task = deliver(env).catch(() => {});
    if (ctx?.waitUntil) ctx.waitUntil(task);
    else await task;
  }
  return result instanceof Response ? result : json(result);
}
export async function handle(req, env, ctx) {
  try {
    return await perform(req, env, ctx);
  } catch (e) {
    if (!e.status) console.error("Pawtect request failed:", e.name);
    return json(
      {
        error: e.status
          ? e.message
          : "No pudimos completar la operación. Recarga el espacio y vuelve a intentarlo.",
      },
      e.status || 500,
    );
  }
}
