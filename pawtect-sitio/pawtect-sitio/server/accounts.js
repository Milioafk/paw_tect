import { authorizeFirstGoogle } from "./roster.js";
import { roleNames, roles } from "../public/ui/catalog.js";
import {
  uuid,
  now,
  random,
  str,
  mail,
  pick,
  sha,
  lookup,
  seal,
  unseal,
  passwordHash,
  same,
  stmt,
  one,
  rows,
  run,
  insert,
  cookie,
  bake,
  json,
  fail,
  role,
  limited,
  record,
  note,
  safeInfo,
  googleIdentity,
  requireRealSettings,
} from "./core.js";
const TTL = 8 * 3600,
  PRACTICE_ROLES = Object.keys(roles);
const sid = "pw_session",
  googleCookie = "pw_google";
const bindHost = (req) => req.headers.get("oai-authenticated-user-id") || "";
export async function current(env, req) {
  if (env.LOCAL_PRACTICE)
    return one(
      env.DB,
      "SELECT * FROM members WHERE id=? AND scope LIKE 'demo-%'",
      env.LOCAL_PRACTICE.memberId || "",
    );
  const token = cookie(req, sid);
  if (!token) return null;
  return one(
    env.DB,
    "SELECT m.* FROM sessions s JOIN members m ON m.id=s.member WHERE m.scope='real' AND s.token=? AND s.expires>? AND s.host_user=?",
    await sha(token),
    now(),
    bindHost(req),
  );
}
async function session(env, req, u, clear = true) {
  if (env.LOCAL_PRACTICE) {
    env.LOCAL_PRACTICE.memberId = u.id;
    return json(await sessionInfo(env, u));
  }
  const token = random(32),
    life = TTL,
    ops = [];
  if (clear && cookie(req, sid))
    ops.push(
      stmt(
        env.DB,
        "DELETE FROM sessions WHERE token=?",
        await sha(cookie(req, sid)),
      ),
    );
  ops.push(
    insert(env.DB, "sessions", {
      token: await sha(token),
      member: u.id,
      expires: now() + life,
      host_user: bindHost(req),
    }),
  );
  await env.DB.batch(ops);
  return json(await sessionInfo(env, u), 200, {
    "Set-Cookie": bake(sid, token, life),
  });
}
export async function sessionInfo(env, u) {
  const school = await one(
    env.DB,
    "SELECT name,domain FROM schools WHERE id=? AND scope=?",
    u.school,
    u.scope,
  );
  const n = await one(
    env.DB,
    "SELECT COUNT(*) AS n FROM notifications WHERE member=? AND seen=0",
    u.id,
  );
  return {
    ...safeInfo(u),
    school: school?.name || "Pawtect",
    domain: school?.domain || "",
    unread: Number(n.n),
    googleOn: !!env.GOOGLE_CLIENT_ID,
    mailOn: !!(env.RESEND_API_KEY && env.EMAIL_FROM),
    realOn: !!(await one(
      env.DB,
      "SELECT id FROM members WHERE id='pawtect-owner'",
    )),
    applicationsOpen: env.PAWTECT_PILOT_OPEN === "1",
  };
}
function publicDomain(domain) {
  domain = str(domain, 3, 100, "El dominio").toLowerCase();
  if (
    !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(domain) ||
    [
      "gmail.com",
      "hotmail.com",
      "yahoo.com",
      "outlook.com",
      "icloud.com",
      "live.com",
      "googlemail.com",
      "pawtect.com",
    ].includes(domain)
  )
    fail(400, "Indica el dominio institucional del colegio.");
  return domain;
}
export async function authAction(ctx, action, b) {
  const { env, req, u } = ctx,
    db = env.DB;
  if (action === "session") {
    if (u) return json(await sessionInfo(env, u));
    return json({
      role: "visitante",
      guest: true,
      demo: false,
      unread: 0,
      googleOn: !!env.GOOGLE_CLIENT_ID,
      applicationsOpen: env.PAWTECT_PILOT_OPEN === "1",
    });
  }
  if (action === "demoRole") {
    if (!env.LOCAL_PRACTICE || !u || u.scope === "real")
      fail(403, "El selector funciona en la demostración.");
    const r = pick(b.role, PRACTICE_ROLES);
    const candidate = await one(
      db,
      "SELECT * FROM members WHERE scope=? AND role=? AND alias=?",
      u.scope,
      r,
      roleNames[r],
    );
    return session(env, req, candidate);
  }
  if (action === "logout") {
    await run(
      db,
      "DELETE FROM sessions WHERE token=?",
      await sha(cookie(req, sid)),
    );
    return json({ ok: true }, 200, { "Set-Cookie": bake(sid, "", 0) });
  }
  if (action === "googleConfig") {
    if (!env.GOOGLE_CLIENT_ID) return json({ enabled: false });
    const n = random(24);
    return json(
      { enabled: true, clientId: env.GOOGLE_CLIENT_ID, nonce: n },
      200,
      { "Set-Cookie": bake(googleCookie, n, 600) },
    );
  }
  if (action === "login") {
    let name = str(b.login, 3, 254, "El usuario").toLowerCase();
    if (/^\d{8}$/.test(name)) name += "@pawtect.com";
    const pw = str(b.password, 1, 160, "La contraseña");
    await limited(db, "login:" + (await sha(name)), 12, 900);
    await limited(db, "ip:" + ctx.client, 45, 900);
    const scopes = env.LOCAL_PRACTICE && u ? [u.scope] : ["real"];
    let found = null;
    for (const scope of scopes) {
      if (scope === "real" && !env.PAWTECT_DATA_KEY) continue;
      const key = await lookup(env, scope, "login", name);
      found = await one(
        db,
        "SELECT * FROM members WHERE scope=? AND login_key=?",
        scope,
        key,
      );
      if (found) break;
    }
    if (
      !found?.password ||
      !same(
        found.password,
        await passwordHash(env, found.scope, pw, found.password.split(".")[0]),
      )
    )
      fail(401, "El usuario o la contraseña no coinciden.");
    return session(env, req, found);
  }
  if (
    action === "googleLogin" ||
    action === "googleLink" ||
    action === "googleRecover"
  ) {
    const g = await googleIdentity(
      b.credential,
      env.GOOGLE_CLIENT_ID,
      cookie(req, googleCookie),
    );
    requireRealSettings(env);
    const key = await lookup(env, "real", "google", g.sub),
      emailKey = await lookup(env, "real", "email", g.email);
    let member;
    if (action !== "googleLink") {
      member = await one(
        db,
        "SELECT * FROM members WHERE scope=? AND google_key=?",
        "real",
        key,
      );
    } else {
      if (!u || u.scope !== "real" || u.must_change)
        fail(
          403,
          "Entra primero con tu cuenta institucional Pawtect y cambia tu clave inicial.",
        );
      if (u.inst_key !== emailKey || (u.google_key && u.google_key !== key))
        fail(
          403,
          "Google debe coincidir con el correo registrado por tu colegio.",
        );
      member = u;
    }
    if (!member && action === "googleLogin") {
      member = await authorizeFirstGoogle(env, g, key, emailKey);
    }
    if (!member || member.inst_key !== emailKey)
      fail(
        403,
        "Tu colegio debe registrar este correo. Si eres parte del personal, vincúlalo primero desde Mi cuenta.",
      );
    const school = await one(
      db,
      "SELECT domain FROM schools WHERE id=? AND scope=?",
      member.school,
      "real",
    );
    if (
      !school ||
      g.hd !== school.domain ||
      g.email.split("@")[1] !== school.domain
    )
      fail(403, "El dominio de Google no está autorizado para este colegio.");
    if (action === "googleRecover") {
      const pass = str(b.password, 12, 128, "La nueva contraseña");
      await db.batch([
        stmt(
          db,
          "UPDATE members SET password=?,must_change=0 WHERE id=?",
          await passwordHash(env, "real", pass),
          member.id,
        ),
        stmt(db, "DELETE FROM sessions WHERE member=?", member.id),
        record(
          db,
          member,
          member.id,
          "Recuperación de contraseña",
          "Google institucional vinculado",
        ),
      ]);
      member.must_change = 0;
    }
    if (
      action === "googleLink" ||
      (action === "googleLogin" && !member.google_key)
    ) {
      const info = await unseal(env, "real", member.identity);
      const identity = await seal(env, "real", { ...info, googleName: g.name });
      const linked = await stmt(
        db,
        "UPDATE members SET google_key=?, identity=?, password=CASE WHEN must_change=1 THEN NULL ELSE password END,must_change=0 WHERE id=? AND (google_key IS NULL OR google_key=?) RETURNING id",
        key,
        identity,
        member.id,
        key,
      ).first();
      if (!linked) fail(409, "Esta cuenta ya tiene otro acceso vinculado.");
      if (member.must_change)
        await run(db, "DELETE FROM sessions WHERE member=?", member.id);
      member.must_change = 0;
    }
    const result = await session(env, req, member);
    result.headers.append("Set-Cookie", bake(googleCookie, "", 0));
    return result;
  }
  if (action === "bootstrap") {
    requireRealSettings(env);
    const hostMail = (
      req.headers.get("oai-authenticated-user-email") || ""
    ).toLowerCase();
    const owner = !!(
      bindHost(req) &&
      env.PAWTECT_ADMIN_EMAIL &&
      hostMail === env.PAWTECT_ADMIN_EMAIL.trim().toLowerCase()
    );
    const allowed = !!(
      env.PAWTECT_SETUP_TOKEN &&
      env.PAWTECT_SETUP_TOKEN.length >= 32 &&
      same(b.token || "", env.PAWTECT_SETUP_TOKEN)
    );
    await limited(db, "bootstrap:" + ctx.client, 12, 900);
    if (!owner && !allowed)
      fail(
        403,
        "El titular debe habilitar el acceso institucional en los ajustes del sitio.",
      );
    const existing = await one(
      db,
      "SELECT * FROM members WHERE id='pawtect-owner'",
    );
    if (existing && !owner)
      fail(409, "Ya existe una administración. Entra con tu cuenta Pawtect.");
    if (existing) return session(env, req, existing);
    const email = owner ? mail(hostMail) : mail(b.email),
      dni = str(b.dni, 8, 8, "El DNI");
    if (!/^\d{8}$/.test(dni)) fail(400, "El DNI debe tener ocho dígitos.");
    const pass = str(b.password, 12, 128, "Tu contraseña");
    const admin = {
      id: "pawtect-owner",
      scope: "real",
      school: "*",
      role: "admin",
      alias: "Administración Pawtect",
      avatar: "equipo",
      identity: await seal(env, "real", {
        name: "Administración",
        dni,
        email,
        grade: "",
        family: "",
      }),
      login_key: await lookup(env, "real", "login", dni + "@pawtect.com"),
      inst_key: await lookup(env, "real", "email", email),
      password: await passwordHash(env, "real", pass),
      must_change: 0,
      forum_until: 0,
      strikes: 0,
    };
    await insert(db, "members", admin).run();
    return session(env, req, admin);
  }
  if (!u) fail(401, "Entra a Pawtect para continuar.");
  if (action === "password") {
    const old = str(b.old, 1, 160, "La clave actual"),
      next = str(b.password, 12, 128, "La clave nueva");
    if (
      !u.password ||
      same(old, next) ||
      !same(
        u.password,
        await passwordHash(env, u.scope, old, u.password.split(".")[0]),
      )
    )
      fail(400, "Revisa la clave actual y elige una clave nueva diferente.");
    await db.batch([
      stmt(
        db,
        "UPDATE members SET password=?,must_change=0 WHERE id=?",
        await passwordHash(env, u.scope, next),
        u.id,
      ),
      stmt(db, "DELETE FROM sessions WHERE member=?", u.id),
    ]);
    return session(env, req, { ...u, must_change: 0 });
  }
  return null;
}
export async function createSchool(env, u, b) {
  role(u, "admin");
  const school = {
    id: uuid(),
    scope: u.scope,
    name: str(b.name, 3, 100, "El colegio"),
    domain: publicDomain(b.domain),
  };
  if (
    await one(
      env.DB,
      "SELECT id FROM schools WHERE scope=? AND domain=?",
      u.scope,
      school.domain,
    )
  )
    fail(409, "Ya registraste ese dominio.");
  await env.DB.batch([
    insert(env.DB, "schools", school),
    record(env.DB, u, school.id, "Registrar colegio", school.name),
  ]);
  return { id: school.id };
}
export async function createMember(env, u, b) {
  role(u, "admin", "plantel");
  const db = env.DB,
    school = await one(
      db,
      "SELECT * FROM schools WHERE id=? AND scope=?",
      u.role === "plantel" ? u.school : b.school,
      u.scope,
    );
  if (!school) fail(400, "Selecciona un colegio autorizado.");
  const target = pick(
    b.role,
    u.role === "admin"
      ? Object.keys(roles).filter((r) => r !== "admin")
      : ["estudiante"],
  );
  const dni = str(b.dni, 8, 8, "El DNI");
  if (!/^\d{8}$/.test(dni)) fail(400, "Escribe los ocho dígitos del DNI.");
  const email = mail(b.email);
  if (email.split("@")[1] !== school.domain)
    fail(400, "El correo debe pertenecer a @" + school.domain + ".");
  const name = str(b.name, 2, 90, "El nombre"),
    grade = str(b.grade || "", 0, 50, "El grado"),
    family = b.family ? mail(b.family) : "";
  const login = dni + "@pawtect.com",
    login_key = await lookup(env, u.scope, "login", login),
    inst_key = await lookup(env, u.scope, "email", email);
  if (
    await one(
      db,
      "SELECT id FROM members WHERE scope=? AND (login_key=? OR inst_key=?)",
      u.scope,
      login_key,
      inst_key,
    )
  )
    fail(409, "Ya existe una cuenta con esos datos.");
  const enrolled = await one(
    db,
    "SELECT id FROM roster WHERE scope=? AND (dni_key=? OR inst_key=?) AND (school<>? OR dni_key<>? OR inst_key<>?)",
    u.scope,
    login_key,
    inst_key,
    school.id,
    login_key,
    inst_key,
  );
  if (enrolled)
    fail(409, "El DNI y el correo deben coincidir con la ficha del padrón.");
  if (
    target !== "estudiante" &&
    (await one(
      db,
      "SELECT id FROM roster WHERE scope=? AND dni_key=?",
      u.scope,
      login_key,
    ))
  )
    fail(
      409,
      "Una ficha del padrón estudiantil solo admite el rol de estudiante.",
    );
  const pass = random(15),
    avatar = ["luna", "sol", "nube", "menta"][
      crypto.getRandomValues(new Uint8Array(1))[0] % 4
    ];
  const alias =
    { luna: "Luna", sol: "Sol", nube: "Nube", menta: "Menta" }[avatar] +
    " " +
    random(4);
  const id = uuid();
  await db.batch([
    insert(db, "members", {
      id,
      scope: u.scope,
      school: school.id,
      role: target,
      alias,
      avatar,
      login_key,
      inst_key,
      identity: await seal(env, u.scope, { dni, name, grade, email, family }),
      password: await passwordHash(env, u.scope, pass),
      must_change: 1,
    }),
    record(db, u, id, "Alta de cuenta", target),
  ]);
  return { login, password: pass, alias };
}

export async function renewInitial(env, u, b) {
  role(u, "admin", "plantel");
  const db = env.DB;
  const dni = str(b.dni, 8, 8, "El DNI");
  if (!/^\d{8}$/.test(dni)) fail(400, "El DNI debe tener ocho dígitos.");
  const key = await lookup(env, u.scope, "login", dni + "@pawtect.com");
  const member = await one(
    db,
    "SELECT * FROM members WHERE scope=? AND login_key=?",
    u.scope,
    key,
  );
  if (
    !member ||
    member.role === "admin" ||
    (u.role === "plantel" &&
      (u.school !== member.school || member.role !== "estudiante"))
  )
    fail(404, "Cuenta pendiente no encontrada en tu institución.");
  if (!member.must_change)
    fail(
      409,
      "Esta cuenta ya está activa. Su titular puede recuperar la contraseña verificando su Google institucional vinculado.",
    );
  const password = random(15),
    hash = await passwordHash(env, u.scope, password);
  const rotated = await stmt(
    db,
    "UPDATE members SET password=? WHERE id=? AND must_change=1 AND password=? RETURNING id",
    hash,
    member.id,
    member.password,
  ).first();
  if (!rotated)
    fail(
      409,
      "La credencial cambió durante esta operación. Revisa el estado antes de reintentar.",
    );
  await db.batch([
    stmt(db, "DELETE FROM sessions WHERE member=?", member.id),
    record(
      db,
      u,
      member.id,
      "Renovación de clave inicial",
      "Cuenta pendiente de activación",
    ),
  ]);
  return { login: dni + "@pawtect.com", password, alias: member.alias };
}
