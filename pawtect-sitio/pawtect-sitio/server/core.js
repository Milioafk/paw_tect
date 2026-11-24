export const uuid = () => crypto.randomUUID();
export const now = () => Math.floor(Date.now() / 1000);
export const random = (n = 24) =>
  b64(crypto.getRandomValues(new Uint8Array(n)));
export function b64(a) {
  return btoa(String.fromCharCode(...new Uint8Array(a)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
function bytes(s) {
  return Uint8Array.from(
    atob(s.replaceAll("-", "+").replaceAll("_", "/")),
    (c) => c.charCodeAt(0),
  );
}
const enc = new TextEncoder(),
  dec = new TextDecoder();
export function fail(status, msg) {
  throw Object.assign(new Error(msg), { status });
}
export function str(v, min, max, label = "El campo") {
  if (typeof v !== "string" || v.trim().length < min || v.trim().length > max)
    fail(400, label + " necesita entre " + min + " y " + max + " caracteres.");
  return v.trim();
}
export function pick(v, allowed, label = "Opción") {
  if (!allowed.includes(v)) fail(400, label + " no válida.");
  return v;
}
export function mail(v) {
  const s = String(v || "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@,;]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(s) || s.length > 254)
    fail(400, "Escribe un correo válido.");
  return s;
}
export const norm = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
export const sha = async (s) =>
  b64(await crypto.subtle.digest("SHA-256", enc.encode(s)));
function keyMaterial(env, scope) {
  if (scope.startsWith("demo-"))
    return "Pawtect: material público reservado a ejemplos ficticios " + scope;
  if (!env.PAWTECT_DATA_KEY || env.PAWTECT_DATA_KEY.length < 32)
    fail(
      503,
      "El responsable debe configurar la clave de protección de datos del piloto.",
    );
  return env.PAWTECT_DATA_KEY;
}
export async function lookup(env, scope, kind, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(keyMaterial(env, scope)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return b64(
    await crypto.subtle.sign("HMAC", key, enc.encode(kind + "|" + value)),
  );
}
async function vaultKey(env, scope) {
  return crypto.subtle.importKey(
    "raw",
    await crypto.subtle.digest(
      "SHA-256",
      enc.encode("vault|" + keyMaterial(env, scope)),
    ),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}
export async function seal(env, scope, v) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return (
    b64(iv) +
    "." +
    b64(
      await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        await vaultKey(env, scope),
        enc.encode(JSON.stringify(v)),
      ),
    )
  );
}
export async function unseal(env, scope, v) {
  const [iv, blob] = v.split(".");
  return JSON.parse(
    dec.decode(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: bytes(iv) },
        await vaultKey(env, scope),
        bytes(blob),
      ),
    ),
  );
}
export async function passwordHash(env, scope, value, salt = random(16)) {
  const k = await crypto.subtle.importKey(
    "raw",
    enc.encode(await lookup(env, scope, "password", value)),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const h = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: bytes(salt), iterations: 100000, hash: "SHA-256" },
    k,
    256,
  );
  return salt + "." + b64(h);
}
export function same(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++)
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
export const stmt = (db, sql, ...args) =>
  args.length ? db.prepare(sql).bind(...args) : db.prepare(sql);
export const one = (db, sql, ...args) => stmt(db, sql, ...args).first();
export const rows = async (db, sql, ...args) =>
  (await stmt(db, sql, ...args).all()).results;
export const run = (db, sql, ...args) => stmt(db, sql, ...args).run();
export function insert(db, table, obj) {
  const keys = Object.keys(obj);
  return stmt(
    db,
    "INSERT INTO " +
      table +
      " (" +
      keys.join(",") +
      ") VALUES (" +
      keys.map(() => "?").join(",") +
      ")",
    ...Object.values(obj),
  );
}
export function cookie(req, k) {
  return (
    (req.headers.get("cookie") || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(k + "="))
      ?.slice(k.length + 1) || ""
  );
}
export function bake(name, val, age) {
  return (
    name +
    "=" +
    val +
    "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" +
    age
  );
}
export function json(v, status = 200, headers = {}) {
  return new Response(JSON.stringify(v), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}
export async function limited(db, name, cap, seconds) {
  const bucket = Math.floor(now() / seconds);
  const item = await stmt(
    db,
    "INSERT INTO limits(id,hits,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET hits=limits.hits+1 RETURNING hits",
    await sha(name + ":" + bucket),
    (bucket + 1) * seconds,
  ).first();
  if (Number(item.hits) > cap)
    fail(
      429,
      "Has hecho varios intentos. Espera un momento y vuelve a intentarlo.",
    );
}
export function role(u, ...list) {
  if (!u || !list.includes(u.role))
    fail(403, "Esta acción está reservada al equipo encargado.");
}
export function record(db, u, object, action, reason) {
  return insert(db, "audit", {
    id: uuid(),
    scope: u.scope,
    actor: u.id,
    object,
    action,
    reason,
    created: now(),
  });
}
export function note(db, id, title, detail, url) {
  return insert(db, "notifications", {
    id: uuid(),
    member: id,
    title,
    detail,
    url,
    seen: 0,
    created: now(),
  });
}
export async function recipients(db, t) {
  const role =
    t.route === "externa"
      ? "equipo"
      : t.route === "psicologia"
        ? "psicologia"
        : "plantel";
  return rows(
    db,
    "SELECT id,identity FROM members WHERE scope=? AND role=? AND (school=? OR school=?)",
    t.scope,
    role,
    t.school,
    "*",
  );
}
export async function notifyOps(
  env,
  scope,
  people,
  title,
  detail,
  url,
  extraEmail,
) {
  const ops = [],
    dest = new Set();
  for (const p of people) {
    ops.push(note(env.DB, p.id, title, detail, url));
    if (scope === "real") {
      const info = await unseal(env, scope, p.identity);
      if (info.email) dest.add(info.email);
    }
  }
  if (extraEmail && scope === "real") dest.add(extraEmail);
  for (const address of dest)
    ops.push(
      insert(env.DB, "outbox", {
        id: uuid(),
        scope,
        destination: await seal(env, scope, address),
        state: "Pendiente",
        created: now(),
      }),
    );
  return ops;
}
export async function deliver(env) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM)
    return { sent: 0, configured: false };
  const pending = await rows(
    env.DB,
    "SELECT * FROM outbox WHERE scope='real' AND state='Pendiente' ORDER BY created LIMIT 10",
  );
  let sent = 0;
  for (const item of pending) {
    if (item.first_attempt && item.first_attempt < now() - 23 * 3600) {
      await run(
        env.DB,
        "UPDATE outbox SET state='Revisar' WHERE id=? AND state='Pendiente'",
        item.id,
      );
      continue;
    }
    if (!item.first_attempt)
      await run(
        env.DB,
        "UPDATE outbox SET first_attempt=? WHERE id=? AND first_attempt=0",
        now(),
        item.id,
      );
    const to = await unseal(env, "real", item.destination);
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + env.RESEND_API_KEY,
          "Content-Type": "application/json",
          "Idempotency-Key": "pawtect/" + item.id,
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: [to],
          subject: "Tienes una actualización en Pawtect",
          text: "Entra a tu cuenta institucional de Pawtect y revisa tus notificaciones. Por privacidad, el contenido del caso se consulta únicamente en el portal.",
        }),
      });
      if (response.ok) {
        await run(
          env.DB,
          "UPDATE outbox SET state='Enviado' WHERE id=?",
          item.id,
        );
        sent++;
      }
    } catch {}
  }
  return { sent, configured: true };
}
export function safeInfo(u) {
  return {
    role: u.role,
    alias: u.alias,
    avatar: u.avatar,
    demo: u.scope !== "real",
    mustChange: !!u.must_change,
    forumUntil: Number(u.forum_until),
    strikes: u.strikes,
  };
}
export function requireRealSettings(env) {
  if (!env.PAWTECT_DATA_KEY || env.PAWTECT_DATA_KEY.length < 32)
    fail(503, "Falta habilitar las cuentas institucionales de este piloto.");
}
let googleKeys = null;
export async function googleIdentity(token, client, nonce) {
  if (!client || !nonce || typeof token !== "string" || token.length > 12000)
    fail(401, "La sesión de Google caducó. Vuelve a abrir el acceso.");
  const parts = token.split(".");
  if (parts.length !== 3) fail(401, "Google no pudo verificar esta cuenta.");
  let h, p;
  try {
    h = JSON.parse(dec.decode(bytes(parts[0])));
    p = JSON.parse(dec.decode(bytes(parts[1])));
  } catch {
    fail(401, "Credencial de Google inválida.");
  }
  if (
    h.alg !== "RS256" ||
    typeof h.kid !== "string" ||
    p.aud !== client ||
    !["https://accounts.google.com", "accounts.google.com"].includes(p.iss) ||
    !p.email_verified ||
    p.email_verified !== true ||
    typeof p.hd !== "string" ||
    !p.hd ||
    typeof p.sub !== "string" ||
    !p.sub ||
    !Number.isFinite(p.exp) ||
    p.exp <= now() ||
    p.iat > now() + 120 ||
    !same(String(p.nonce || ""), nonce)
  )
    fail(
      401,
      "Usa el Google Workspace institucional autorizado por tu colegio.",
    );
  if (
    !googleKeys ||
    googleKeys.until < now() ||
    !googleKeys.keys.some((k) => k.kid === h.kid)
  ) {
    const r = await fetch("https://www.googleapis.com/oauth2/v3/certs");
    if (!r.ok) fail(503, "Google no está disponible en este momento.");
    const data = await r.json();
    const ttl = Number(
      (r.headers.get("cache-control") || "").match(/max-age=(\d+)/)?.[1] || 300,
    );
    googleKeys = { until: now() + Math.min(ttl, 86400), keys: data.keys };
  }
  const jwk = googleKeys.keys.find((k) => k.kid === h.kid);
  if (!jwk) fail(401, "La firma de Google no coincide.");
  const k = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  if (
    !(await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      k,
      bytes(parts[2]),
      enc.encode(parts.slice(0, 2).join(".")),
    ))
  )
    fail(401, "Google no pudo verificar esta cuenta.");
  return {
    email: mail(p.email),
    hd: p.hd.toLowerCase(),
    sub: p.sub,
    name: typeof p.name === "string" ? p.name.trim().slice(0, 90) : "",
  };
}
