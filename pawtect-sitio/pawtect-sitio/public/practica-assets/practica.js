"use strict";
(() => {
  // server/core.js
  var uuid = () => crypto.randomUUID();
  var now = () => Math.floor(Date.now() / 1e3);
  var random = (n = 24) => b64(crypto.getRandomValues(new Uint8Array(n)));
  function b64(a) {
    return btoa(String.fromCharCode(...new Uint8Array(a))).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  }
  function bytes(s) {
    return Uint8Array.from(
      atob(s.replaceAll("-", "+").replaceAll("_", "/")),
      (c) => c.charCodeAt(0)
    );
  }
  var enc = new TextEncoder();
  var dec = new TextDecoder();
  function fail(status, msg) {
    throw Object.assign(new Error(msg), { status });
  }
  function str(v, min, max, label = "El campo") {
    if (typeof v !== "string" || v.trim().length < min || v.trim().length > max)
      fail(400, label + " necesita entre " + min + " y " + max + " caracteres.");
    return v.trim();
  }
  function pick(v, allowed, label = "Opci\xF3n") {
    if (!allowed.includes(v)) fail(400, label + " no v\xE1lida.");
    return v;
  }
  function mail(v) {
    const s = String(v || "").trim().toLowerCase();
    if (!/^[^\s@,;]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(s) || s.length > 254)
      fail(400, "Escribe un correo v\xE1lido.");
    return s;
  }
  var norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  var sha = async (s) => b64(await crypto.subtle.digest("SHA-256", enc.encode(s)));
  function keyMaterial(env2, scope) {
    if (scope.startsWith("demo-"))
      return "Pawtect: material p\xFAblico reservado a ejemplos ficticios " + scope;
    if (!env2.PAWTECT_DATA_KEY || env2.PAWTECT_DATA_KEY.length < 32)
      fail(
        503,
        "El responsable debe configurar la clave de protecci\xF3n de datos del piloto."
      );
    return env2.PAWTECT_DATA_KEY;
  }
  async function lookup(env2, scope, kind, value) {
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(keyMaterial(env2, scope)),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    return b64(
      await crypto.subtle.sign("HMAC", key, enc.encode(kind + "|" + value))
    );
  }
  async function vaultKey(env2, scope) {
    return crypto.subtle.importKey(
      "raw",
      await crypto.subtle.digest(
        "SHA-256",
        enc.encode("vault|" + keyMaterial(env2, scope))
      ),
      "AES-GCM",
      false,
      ["encrypt", "decrypt"]
    );
  }
  async function seal(env2, scope, v) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    return b64(iv) + "." + b64(
      await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        await vaultKey(env2, scope),
        enc.encode(JSON.stringify(v))
      )
    );
  }
  async function unseal(env2, scope, v) {
    const [iv, blob] = v.split(".");
    return JSON.parse(
      dec.decode(
        await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: bytes(iv) },
          await vaultKey(env2, scope),
          bytes(blob)
        )
      )
    );
  }
  async function passwordHash(env2, scope, value, salt = random(16)) {
    const k = await crypto.subtle.importKey(
      "raw",
      enc.encode(await lookup(env2, scope, "password", value)),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const h = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: bytes(salt), iterations: 1e5, hash: "SHA-256" },
      k,
      256
    );
    return salt + "." + b64(h);
  }
  function same(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    let mismatch = 0;
    for (let i = 0; i < a.length; i++)
      mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return mismatch === 0;
  }
  var stmt = (db, sql, ...args) => args.length ? db.prepare(sql).bind(...args) : db.prepare(sql);
  var one = (db, sql, ...args) => stmt(db, sql, ...args).first();
  var rows = async (db, sql, ...args) => (await stmt(db, sql, ...args).all()).results;
  var run = (db, sql, ...args) => stmt(db, sql, ...args).run();
  function insert(db, table, obj) {
    const keys = Object.keys(obj);
    return stmt(
      db,
      "INSERT INTO " + table + " (" + keys.join(",") + ") VALUES (" + keys.map(() => "?").join(",") + ")",
      ...Object.values(obj)
    );
  }
  function cookie(req, k) {
    return (req.headers.get("cookie") || "").split(";").map((s) => s.trim()).find((s) => s.startsWith(k + "="))?.slice(k.length + 1) || "";
  }
  function bake(name, val, age) {
    return name + "=" + val + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + age;
  }
  function json(v, status = 200, headers = {}) {
    return new Response(JSON.stringify(v), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
        ...headers
      }
    });
  }
  async function limited(db, name, cap, seconds) {
    const bucket = Math.floor(now() / seconds);
    const item = await stmt(
      db,
      "INSERT INTO limits(id,hits,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET hits=limits.hits+1 RETURNING hits",
      await sha(name + ":" + bucket),
      (bucket + 1) * seconds
    ).first();
    if (Number(item.hits) > cap)
      fail(
        429,
        "Has hecho varios intentos. Espera un momento y vuelve a intentarlo."
      );
  }
  function role(u, ...list) {
    if (!u || !list.includes(u.role))
      fail(403, "Esta acci\xF3n est\xE1 reservada al equipo encargado.");
  }
  function record(db, u, object, action, reason) {
    return insert(db, "audit", {
      id: uuid(),
      scope: u.scope,
      actor: u.id,
      object,
      action,
      reason,
      created: now()
    });
  }
  function note(db, id, title, detail, url) {
    return insert(db, "notifications", {
      id: uuid(),
      member: id,
      title,
      detail,
      url,
      seen: 0,
      created: now()
    });
  }
  async function recipients(db, t) {
    const role2 = t.route === "externa" ? "equipo" : t.route === "psicologia" ? "psicologia" : "plantel";
    return rows(
      db,
      "SELECT id,identity FROM members WHERE scope=? AND role=? AND (school=? OR school=?)",
      t.scope,
      role2,
      t.school,
      "*"
    );
  }
  async function notifyOps(env2, scope, people, title, detail, url, extraEmail) {
    const ops = [], dest = /* @__PURE__ */ new Set();
    for (const p of people) {
      ops.push(note(env2.DB, p.id, title, detail, url));
      if (scope === "real") {
        const info = await unseal(env2, scope, p.identity);
        if (info.email) dest.add(info.email);
      }
    }
    if (extraEmail && scope === "real") dest.add(extraEmail);
    for (const address of dest)
      ops.push(
        insert(env2.DB, "outbox", {
          id: uuid(),
          scope,
          destination: await seal(env2, scope, address),
          state: "Pendiente",
          created: now()
        })
      );
    return ops;
  }
  async function deliver(env2) {
    if (!env2.RESEND_API_KEY || !env2.EMAIL_FROM)
      return { sent: 0, configured: false };
    const pending = await rows(
      env2.DB,
      "SELECT * FROM outbox WHERE scope='real' AND state='Pendiente' ORDER BY created LIMIT 10"
    );
    let sent = 0;
    for (const item of pending) {
      if (item.first_attempt && item.first_attempt < now() - 23 * 3600) {
        await run(
          env2.DB,
          "UPDATE outbox SET state='Revisar' WHERE id=? AND state='Pendiente'",
          item.id
        );
        continue;
      }
      if (!item.first_attempt)
        await run(
          env2.DB,
          "UPDATE outbox SET first_attempt=? WHERE id=? AND first_attempt=0",
          now(),
          item.id
        );
      const to = await unseal(env2, "real", item.destination);
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + env2.RESEND_API_KEY,
            "Content-Type": "application/json",
            "Idempotency-Key": "pawtect/" + item.id
          },
          body: JSON.stringify({
            from: env2.EMAIL_FROM,
            to: [to],
            subject: "Tienes una actualizaci\xF3n en Pawtect",
            text: "Entra a tu cuenta institucional de Pawtect y revisa tus notificaciones. Por privacidad, el contenido del caso se consulta \xFAnicamente en el portal."
          })
        });
        if (response.ok) {
          await run(
            env2.DB,
            "UPDATE outbox SET state='Enviado' WHERE id=?",
            item.id
          );
          sent++;
        }
      } catch {
      }
    }
    return { sent, configured: true };
  }
  function safeInfo(u) {
    return {
      role: u.role,
      alias: u.alias,
      avatar: u.avatar,
      demo: u.scope !== "real",
      mustChange: !!u.must_change,
      forumUntil: Number(u.forum_until),
      strikes: u.strikes
    };
  }
  function requireRealSettings(env2) {
    if (!env2.PAWTECT_DATA_KEY || env2.PAWTECT_DATA_KEY.length < 32)
      fail(503, "Falta habilitar las cuentas institucionales de este piloto.");
  }
  var googleKeys = null;
  async function googleIdentity(token, client, nonce) {
    if (!client || !nonce || typeof token !== "string" || token.length > 12e3)
      fail(401, "La sesi\xF3n de Google caduc\xF3. Vuelve a abrir el acceso.");
    const parts = token.split(".");
    if (parts.length !== 3) fail(401, "Google no pudo verificar esta cuenta.");
    let h, p;
    try {
      h = JSON.parse(dec.decode(bytes(parts[0])));
      p = JSON.parse(dec.decode(bytes(parts[1])));
    } catch {
      fail(401, "Credencial de Google inv\xE1lida.");
    }
    if (h.alg !== "RS256" || typeof h.kid !== "string" || p.aud !== client || !["https://accounts.google.com", "accounts.google.com"].includes(p.iss) || !p.email_verified || p.email_verified !== true || typeof p.hd !== "string" || !p.hd || typeof p.sub !== "string" || !p.sub || !Number.isFinite(p.exp) || p.exp <= now() || p.iat > now() + 120 || !same(String(p.nonce || ""), nonce))
      fail(
        401,
        "Usa el Google Workspace institucional autorizado por tu colegio."
      );
    if (!googleKeys || googleKeys.until < now() || !googleKeys.keys.some((k2) => k2.kid === h.kid)) {
      const r = await fetch("https://www.googleapis.com/oauth2/v3/certs");
      if (!r.ok) fail(503, "Google no est\xE1 disponible en este momento.");
      const data = await r.json();
      const ttl = Number(
        (r.headers.get("cache-control") || "").match(/max-age=(\d+)/)?.[1] || 300
      );
      googleKeys = { until: now() + Math.min(ttl, 86400), keys: data.keys };
    }
    const jwk = googleKeys.keys.find((k2) => k2.kid === h.kid);
    if (!jwk) fail(401, "La firma de Google no coincide.");
    const k = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    if (!await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      k,
      bytes(parts[2]),
      enc.encode(parts.slice(0, 2).join("."))
    ))
      fail(401, "Google no pudo verificar esta cuenta.");
    return {
      email: mail(p.email),
      hd: p.hd.toLowerCase(),
      sub: p.sub,
      name: typeof p.name === "string" ? p.name.trim().slice(0, 90) : ""
    };
  }

  // server/roster.js
  var dniOf = (value) => {
    if (!/^\d{8}$/.test(String(value ?? "")))
      fail(400, "El DNI debe tener ocho d\xEDgitos.");
    return String(value);
  };
  async function rosterAction(env2, u, action, body) {
    role(u, "admin", "plantel");
    const db = env2.DB;
    const school = await one(
      db,
      "SELECT id,domain FROM schools WHERE scope=? AND id=?",
      u.scope,
      u.role === "plantel" ? u.school : body.school || ""
    );
    if (!school || body.school && school.id !== body.school)
      fail(403, "Selecciona un colegio a tu cargo.");
    if (action === "rosterLookup") {
      await limited(db, "padron:" + u.id, 45, 900);
      const key = await lookup(
        env2,
        u.scope,
        "login",
        dniOf(body.dni) + "@pawtect.com"
      );
      const entry = await one(
        db,
        "SELECT id,identity FROM roster WHERE scope=? AND school=? AND dni_key=?",
        u.scope,
        school.id,
        key
      ) || await one(
        db,
        "SELECT id,identity FROM members WHERE scope=? AND school=? AND login_key=?",
        u.scope,
        school.id,
        key
      );
      if (!entry)
        fail(404, "Este DNI todav\xEDa no figura en el padr\xF3n de este colegio.");
      const data = await unseal(env2, u.scope, entry.identity);
      await record(
        db,
        u,
        entry.id,
        "Consulta de padr\xF3n",
        "Preparaci\xF3n de cuenta institucional"
      ).run();
      return { name: data.name, grade: data.grade, email: data.email };
    }
    if (!Array.isArray(body.rows) || !body.rows.length || body.rows.length > 50)
      fail(400, "Importa de 1 a 50 estudiantes por archivo.");
    const seenDni = /* @__PURE__ */ new Set(), seenMail = /* @__PURE__ */ new Set(), prepared = [];
    for (const [index, row] of body.rows.entries()) {
      const dni = dniOf(row?.dni), email = mail(row?.correo), name = str(row?.nombre, 2, 90, "El nombre de la fila " + (index + 2));
      const grade = str(row?.grado || "", 0, 50, "El grado");
      if (email.split("@")[1] !== school.domain)
        fail(
          400,
          "La fila " + (index + 2) + " necesita un correo de @" + school.domain + "."
        );
      if (seenDni.has(dni) || seenMail.has(email))
        fail(400, "Hay un DNI o correo repetido en la fila " + (index + 2) + ".");
      seenDni.add(dni);
      seenMail.add(email);
      const dk = await lookup(env2, u.scope, "login", dni + "@pawtect.com"), ek = await lookup(env2, u.scope, "email", email);
      prepared.push({
        dk,
        ek,
        row: index + 2,
        identity: await seal(env2, u.scope, {
          dni,
          email,
          name,
          grade,
          family: ""
        })
      });
    }
    const byDni = new Map(prepared.map((r) => [r.dk, r])), byEmail = new Map(prepared.map((r) => [r.ek, r]));
    for (let start = 0; start < prepared.length; start += 24) {
      const chunk = prepared.slice(start, start + 24), markers = chunk.map(() => "?").join(",");
      const args = [
        u.scope,
        ...chunk.map((r) => r.dk),
        ...chunk.map((r) => r.ek)
      ];
      const enrolled = await rows(
        db,
        `SELECT school,dni_key AS dk,inst_key AS ek FROM roster WHERE scope=? AND (dni_key IN (${markers}) OR inst_key IN (${markers}))`,
        ...args
      );
      const members = await rows(
        db,
        `SELECT school,login_key AS dk,inst_key AS ek,role FROM members WHERE scope=? AND (login_key IN (${markers}) OR inst_key IN (${markers}))`,
        ...args
      );
      for (const record2 of [...enrolled, ...members]) {
        const incoming = byDni.get(record2.dk) || byEmail.get(record2.ek);
        if (!incoming || incoming.dk !== record2.dk || incoming.ek !== record2.ek || record2.school !== school.id || record2.role && record2.role !== "estudiante")
          fail(
            409,
            "Revisa el DNI y el correo de la fila " + incoming?.row + ". Ya hay un registro incompatible."
          );
      }
    }
    const ops = prepared.map(
      (r) => stmt(
        db,
        "INSERT INTO roster(id,scope,school,dni_key,inst_key,identity) VALUES(?,?,?,?,?,?) ON CONFLICT(scope,dni_key) DO UPDATE SET identity=CASE WHEN roster.school=excluded.school AND roster.inst_key=excluded.inst_key THEN excluded.identity ELSE NULL END",
        uuid(),
        u.scope,
        school.id,
        r.dk,
        r.ek,
        r.identity
      )
    );
    ops.push(
      record(
        db,
        u,
        school.id,
        "Importaci\xF3n de padr\xF3n",
        body.rows.length + " fichas de estudiantes"
      )
    );
    try {
      await db.batch(ops);
    } catch (e) {
      if (/unique|constraint|not.null/i.test(
        String(e.message) + " " + String(e.cause?.message)
      ))
        fail(
          409,
          "El padr\xF3n cambi\xF3. Vuelve a revisar el archivo antes de importarlo."
        );
      throw e;
    }
    return { count: body.rows.length };
  }
  async function authorizeFirstGoogle(env2, g, key, emailKey) {
    const db = env2.DB;
    const candidate = await one(
      db,
      "SELECT * FROM members WHERE scope='real' AND inst_key=?",
      emailKey
    );
    if (candidate)
      return candidate.role === "estudiante" && (!candidate.google_key || candidate.google_key === key) ? candidate : null;
    const entry = await one(
      db,
      "SELECT r.*,s.domain FROM roster r JOIN schools s ON s.id=r.school AND s.scope=r.scope WHERE r.scope='real' AND r.inst_key=?",
      emailKey
    );
    if (!entry || entry.domain !== g.hd || g.email.split("@")[1] !== entry.domain)
      return null;
    const p = await unseal(env2, "real", entry.identity);
    const identity = await seal(env2, "real", { ...p, googleName: g.name });
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
      key
    ).run();
    const added = await one(
      db,
      "SELECT * FROM members WHERE scope='real' AND inst_key=? AND school=? AND login_key=?",
      emailKey,
      entry.school,
      entry.dni_key
    );
    return added?.role === "estudiante" && (!added.google_key || added.google_key === key) ? added : null;
  }

  // public/ui/catalog.js
  var roles = {
    estudiante: "Estudiante",
    plantel: "Convivencia escolar",
    psicologia: "Psicolog\xEDa",
    equipo: "Equipo Pawtect",
    admin: "Administraci\xF3n"
  };
  var categories = ["Experiencias", "Consejos", "Preguntas"];
  var topics = [
    "Acoso verbal",
    "Acoso f\xEDsico",
    "Exclusi\xF3n",
    "Ciberacoso",
    "Amenaza",
    "Bienestar emocional",
    "Otro"
  ];
  var priorities = ["Normal", "Alta", "Urgente"];
  var states = [
    "Recibido",
    "En revisi\xF3n",
    "En acompa\xF1amiento",
    "Resuelto"
  ];
  var samplePosts = [
    {
      key: "luna",
      alias: "Luna Violeta",
      avatar: "luna",
      category: "Experiencias",
      title: "Hoy me anim\xE9 a hablar con mi tutora",
      body: "Me daba nervios contarle lo que pasaba en el recreo. Al final me escuch\xF3 sin apurarme. \xBFA alguien m\xE1s le cost\xF3 dar ese primer paso?",
      minutes: 24,
      hearts: 12,
      replies: [
        [
          "sol",
          "A m\xED tambi\xE9n. Me ayud\xF3 escribir lo que quer\xEDa decir antes de acercarme."
        ],
        ["nube", "Gracias por contarlo. Leer esto me anima a intentarlo."]
      ]
    },
    {
      key: "sol",
      alias: "Sol de Menta",
      avatar: "sol",
      category: "Consejos",
      title: "Algo que me ayud\xF3 cuando me sent\xED fuera del grupo",
      body: "Una compa\xF1era me guard\xF3 un sitio en su mesa. Desde entonces intento hacer lo mismo cuando veo a alguien comiendo a solas.",
      minutes: 68,
      hearts: 8,
      replies: [["luna", "Un gesto peque\xF1o puede cambiarte el d\xEDa."]]
    },
    {
      key: "nube",
      alias: "Nube Azul",
      avatar: "nube",
      category: "Preguntas",
      title: "\xBFC\xF3mo acompa\xF1an a un amigo que todav\xEDa no quiere hablar?",
      body: "Quiero que sepa que puede contar conmigo, pero tambi\xE9n respetar su espacio. \xBFQu\xE9 les ha servido a ustedes?",
      minutes: 155,
      hearts: 5,
      replies: []
    }
  ];
  var roleNames = {
    estudiante: "Menta Clara",
    plantel: "Equipo de convivencia",
    psicologia: "Psicolog\xEDa Pawtect",
    equipo: "Protecci\xF3n Pawtect",
    admin: "Administraci\xF3n Pawtect"
  };

  // server/accounts.js
  var TTL = 8 * 3600;
  var PRACTICE_ROLES = Object.keys(roles);
  var sid = "pw_session";
  var googleCookie = "pw_google";
  var bindHost = (req) => req.headers.get("oai-authenticated-user-id") || "";
  async function current(env2, req) {
    if (env2.LOCAL_PRACTICE)
      return one(
        env2.DB,
        "SELECT * FROM members WHERE id=? AND scope LIKE 'demo-%'",
        env2.LOCAL_PRACTICE.memberId || ""
      );
    const token = cookie(req, sid);
    if (!token) return null;
    return one(
      env2.DB,
      "SELECT m.* FROM sessions s JOIN members m ON m.id=s.member WHERE m.scope='real' AND s.token=? AND s.expires>? AND s.host_user=?",
      await sha(token),
      now(),
      bindHost(req)
    );
  }
  async function session(env2, req, u, clear = true) {
    if (env2.LOCAL_PRACTICE) {
      env2.LOCAL_PRACTICE.memberId = u.id;
      return json(await sessionInfo(env2, u));
    }
    const token = random(32), life = TTL, ops = [];
    if (clear && cookie(req, sid))
      ops.push(
        stmt(
          env2.DB,
          "DELETE FROM sessions WHERE token=?",
          await sha(cookie(req, sid))
        )
      );
    ops.push(
      insert(env2.DB, "sessions", {
        token: await sha(token),
        member: u.id,
        expires: now() + life,
        host_user: bindHost(req)
      })
    );
    await env2.DB.batch(ops);
    return json(await sessionInfo(env2, u), 200, {
      "Set-Cookie": bake(sid, token, life)
    });
  }
  async function sessionInfo(env2, u) {
    const school = await one(
      env2.DB,
      "SELECT name,domain FROM schools WHERE id=? AND scope=?",
      u.school,
      u.scope
    );
    const n = await one(
      env2.DB,
      "SELECT COUNT(*) AS n FROM notifications WHERE member=? AND seen=0",
      u.id
    );
    return {
      ...safeInfo(u),
      school: school?.name || "Pawtect",
      domain: school?.domain || "",
      unread: Number(n.n),
      googleOn: !!env2.GOOGLE_CLIENT_ID,
      mailOn: !!(env2.RESEND_API_KEY && env2.EMAIL_FROM),
      realOn: !!await one(
        env2.DB,
        "SELECT id FROM members WHERE id='pawtect-owner'"
      ),
      applicationsOpen: env2.PAWTECT_PILOT_OPEN === "1"
    };
  }
  function publicDomain(domain) {
    domain = str(domain, 3, 100, "El dominio").toLowerCase();
    if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(domain) || [
      "gmail.com",
      "hotmail.com",
      "yahoo.com",
      "outlook.com",
      "icloud.com",
      "live.com",
      "googlemail.com",
      "pawtect.com"
    ].includes(domain))
      fail(400, "Indica el dominio institucional del colegio.");
    return domain;
  }
  async function authAction(ctx, action, b) {
    const { env: env2, req, u } = ctx, db = env2.DB;
    if (action === "session") {
      if (u) return json(await sessionInfo(env2, u));
      return json({
        role: "visitante",
        guest: true,
        demo: false,
        unread: 0,
        googleOn: !!env2.GOOGLE_CLIENT_ID,
        applicationsOpen: env2.PAWTECT_PILOT_OPEN === "1"
      });
    }
    if (action === "demoRole") {
      if (!env2.LOCAL_PRACTICE || !u || u.scope === "real")
        fail(403, "El selector funciona en la demostraci\xF3n.");
      const r = pick(b.role, PRACTICE_ROLES);
      const candidate = await one(
        db,
        "SELECT * FROM members WHERE scope=? AND role=? AND alias=?",
        u.scope,
        r,
        roleNames[r]
      );
      return session(env2, req, candidate);
    }
    if (action === "logout") {
      await run(
        db,
        "DELETE FROM sessions WHERE token=?",
        await sha(cookie(req, sid))
      );
      return json({ ok: true }, 200, { "Set-Cookie": bake(sid, "", 0) });
    }
    if (action === "googleConfig") {
      if (!env2.GOOGLE_CLIENT_ID) return json({ enabled: false });
      const n = random(24);
      return json(
        { enabled: true, clientId: env2.GOOGLE_CLIENT_ID, nonce: n },
        200,
        { "Set-Cookie": bake(googleCookie, n, 600) }
      );
    }
    if (action === "login") {
      let name = str(b.login, 3, 254, "El usuario").toLowerCase();
      if (/^\d{8}$/.test(name)) name += "@pawtect.com";
      const pw = str(b.password, 1, 160, "La contrase\xF1a");
      await limited(db, "login:" + await sha(name), 12, 900);
      await limited(db, "ip:" + ctx.client, 45, 900);
      const scopes = env2.LOCAL_PRACTICE && u ? [u.scope] : ["real"];
      let found = null;
      for (const scope of scopes) {
        if (scope === "real" && !env2.PAWTECT_DATA_KEY) continue;
        const key = await lookup(env2, scope, "login", name);
        found = await one(
          db,
          "SELECT * FROM members WHERE scope=? AND login_key=?",
          scope,
          key
        );
        if (found) break;
      }
      if (!found?.password || !same(
        found.password,
        await passwordHash(env2, found.scope, pw, found.password.split(".")[0])
      ))
        fail(401, "El usuario o la contrase\xF1a no coinciden.");
      return session(env2, req, found);
    }
    if (action === "googleLogin" || action === "googleLink" || action === "googleRecover") {
      const g = await googleIdentity(
        b.credential,
        env2.GOOGLE_CLIENT_ID,
        cookie(req, googleCookie)
      );
      requireRealSettings(env2);
      const key = await lookup(env2, "real", "google", g.sub), emailKey = await lookup(env2, "real", "email", g.email);
      let member;
      if (action !== "googleLink") {
        member = await one(
          db,
          "SELECT * FROM members WHERE scope=? AND google_key=?",
          "real",
          key
        );
      } else {
        if (!u || u.scope !== "real" || u.must_change)
          fail(
            403,
            "Entra primero con tu cuenta institucional Pawtect y cambia tu clave inicial."
          );
        if (u.inst_key !== emailKey || u.google_key && u.google_key !== key)
          fail(
            403,
            "Google debe coincidir con el correo registrado por tu colegio."
          );
        member = u;
      }
      if (!member && action === "googleLogin") {
        member = await authorizeFirstGoogle(env2, g, key, emailKey);
      }
      if (!member || member.inst_key !== emailKey)
        fail(
          403,
          "Tu colegio debe registrar este correo. Si eres parte del personal, vinc\xFAlalo primero desde Mi cuenta."
        );
      const school = await one(
        db,
        "SELECT domain FROM schools WHERE id=? AND scope=?",
        member.school,
        "real"
      );
      if (!school || g.hd !== school.domain || g.email.split("@")[1] !== school.domain)
        fail(403, "El dominio de Google no est\xE1 autorizado para este colegio.");
      if (action === "googleRecover") {
        const pass = str(b.password, 12, 128, "La nueva contrase\xF1a");
        await db.batch([
          stmt(
            db,
            "UPDATE members SET password=?,must_change=0 WHERE id=?",
            await passwordHash(env2, "real", pass),
            member.id
          ),
          stmt(db, "DELETE FROM sessions WHERE member=?", member.id),
          record(
            db,
            member,
            member.id,
            "Recuperaci\xF3n de contrase\xF1a",
            "Google institucional vinculado"
          )
        ]);
        member.must_change = 0;
      }
      if (action === "googleLink" || action === "googleLogin" && !member.google_key) {
        const info = await unseal(env2, "real", member.identity);
        const identity = await seal(env2, "real", { ...info, googleName: g.name });
        const linked = await stmt(
          db,
          "UPDATE members SET google_key=?, identity=?, password=CASE WHEN must_change=1 THEN NULL ELSE password END,must_change=0 WHERE id=? AND (google_key IS NULL OR google_key=?) RETURNING id",
          key,
          identity,
          member.id,
          key
        ).first();
        if (!linked) fail(409, "Esta cuenta ya tiene otro acceso vinculado.");
        if (member.must_change)
          await run(db, "DELETE FROM sessions WHERE member=?", member.id);
        member.must_change = 0;
      }
      const result = await session(env2, req, member);
      result.headers.append("Set-Cookie", bake(googleCookie, "", 0));
      return result;
    }
    if (action === "bootstrap") {
      requireRealSettings(env2);
      const hostMail = (req.headers.get("oai-authenticated-user-email") || "").toLowerCase();
      const owner = !!(bindHost(req) && env2.PAWTECT_ADMIN_EMAIL && hostMail === env2.PAWTECT_ADMIN_EMAIL.trim().toLowerCase());
      const allowed = !!(env2.PAWTECT_SETUP_TOKEN && env2.PAWTECT_SETUP_TOKEN.length >= 32 && same(b.token || "", env2.PAWTECT_SETUP_TOKEN));
      await limited(db, "bootstrap:" + ctx.client, 12, 900);
      if (!owner && !allowed)
        fail(
          403,
          "El titular debe habilitar el acceso institucional en los ajustes del sitio."
        );
      const existing = await one(
        db,
        "SELECT * FROM members WHERE id='pawtect-owner'"
      );
      if (existing && !owner)
        fail(409, "Ya existe una administraci\xF3n. Entra con tu cuenta Pawtect.");
      if (existing) return session(env2, req, existing);
      const email = owner ? mail(hostMail) : mail(b.email), dni = str(b.dni, 8, 8, "El DNI");
      if (!/^\d{8}$/.test(dni)) fail(400, "El DNI debe tener ocho d\xEDgitos.");
      const pass = str(b.password, 12, 128, "Tu contrase\xF1a");
      const admin = {
        id: "pawtect-owner",
        scope: "real",
        school: "*",
        role: "admin",
        alias: "Administraci\xF3n Pawtect",
        avatar: "equipo",
        identity: await seal(env2, "real", {
          name: "Administraci\xF3n",
          dni,
          email,
          grade: "",
          family: ""
        }),
        login_key: await lookup(env2, "real", "login", dni + "@pawtect.com"),
        inst_key: await lookup(env2, "real", "email", email),
        password: await passwordHash(env2, "real", pass),
        must_change: 0,
        forum_until: 0,
        strikes: 0
      };
      await insert(db, "members", admin).run();
      return session(env2, req, admin);
    }
    if (!u) fail(401, "Entra a Pawtect para continuar.");
    if (action === "password") {
      const old = str(b.old, 1, 160, "La clave actual"), next = str(b.password, 12, 128, "La clave nueva");
      if (!u.password || same(old, next) || !same(
        u.password,
        await passwordHash(env2, u.scope, old, u.password.split(".")[0])
      ))
        fail(400, "Revisa la clave actual y elige una clave nueva diferente.");
      await db.batch([
        stmt(
          db,
          "UPDATE members SET password=?,must_change=0 WHERE id=?",
          await passwordHash(env2, u.scope, next),
          u.id
        ),
        stmt(db, "DELETE FROM sessions WHERE member=?", u.id)
      ]);
      return session(env2, req, { ...u, must_change: 0 });
    }
    return null;
  }
  async function createSchool(env2, u, b) {
    role(u, "admin");
    const school = {
      id: uuid(),
      scope: u.scope,
      name: str(b.name, 3, 100, "El colegio"),
      domain: publicDomain(b.domain)
    };
    if (await one(
      env2.DB,
      "SELECT id FROM schools WHERE scope=? AND domain=?",
      u.scope,
      school.domain
    ))
      fail(409, "Ya registraste ese dominio.");
    await env2.DB.batch([
      insert(env2.DB, "schools", school),
      record(env2.DB, u, school.id, "Registrar colegio", school.name)
    ]);
    return { id: school.id };
  }
  async function createMember(env2, u, b) {
    role(u, "admin", "plantel");
    const db = env2.DB, school = await one(
      db,
      "SELECT * FROM schools WHERE id=? AND scope=?",
      u.role === "plantel" ? u.school : b.school,
      u.scope
    );
    if (!school) fail(400, "Selecciona un colegio autorizado.");
    const target = pick(
      b.role,
      u.role === "admin" ? Object.keys(roles).filter((r) => r !== "admin") : ["estudiante"]
    );
    const dni = str(b.dni, 8, 8, "El DNI");
    if (!/^\d{8}$/.test(dni)) fail(400, "Escribe los ocho d\xEDgitos del DNI.");
    const email = mail(b.email);
    if (email.split("@")[1] !== school.domain)
      fail(400, "El correo debe pertenecer a @" + school.domain + ".");
    const name = str(b.name, 2, 90, "El nombre"), grade = str(b.grade || "", 0, 50, "El grado"), family = b.family ? mail(b.family) : "";
    const login = dni + "@pawtect.com", login_key = await lookup(env2, u.scope, "login", login), inst_key = await lookup(env2, u.scope, "email", email);
    if (await one(
      db,
      "SELECT id FROM members WHERE scope=? AND (login_key=? OR inst_key=?)",
      u.scope,
      login_key,
      inst_key
    ))
      fail(409, "Ya existe una cuenta con esos datos.");
    const enrolled = await one(
      db,
      "SELECT id FROM roster WHERE scope=? AND (dni_key=? OR inst_key=?) AND (school<>? OR dni_key<>? OR inst_key<>?)",
      u.scope,
      login_key,
      inst_key,
      school.id,
      login_key,
      inst_key
    );
    if (enrolled)
      fail(409, "El DNI y el correo deben coincidir con la ficha del padr\xF3n.");
    if (target !== "estudiante" && await one(
      db,
      "SELECT id FROM roster WHERE scope=? AND dni_key=?",
      u.scope,
      login_key
    ))
      fail(
        409,
        "Una ficha del padr\xF3n estudiantil solo admite el rol de estudiante."
      );
    const pass = random(15), avatar = ["luna", "sol", "nube", "menta"][crypto.getRandomValues(new Uint8Array(1))[0] % 4];
    const alias = { luna: "Luna", sol: "Sol", nube: "Nube", menta: "Menta" }[avatar] + " " + random(4);
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
        identity: await seal(env2, u.scope, { dni, name, grade, email, family }),
        password: await passwordHash(env2, u.scope, pass),
        must_change: 1
      }),
      record(db, u, id, "Alta de cuenta", target)
    ]);
    return { login, password: pass, alias };
  }
  async function renewInitial(env2, u, b) {
    role(u, "admin", "plantel");
    const db = env2.DB;
    const dni = str(b.dni, 8, 8, "El DNI");
    if (!/^\d{8}$/.test(dni)) fail(400, "El DNI debe tener ocho d\xEDgitos.");
    const key = await lookup(env2, u.scope, "login", dni + "@pawtect.com");
    const member = await one(
      db,
      "SELECT * FROM members WHERE scope=? AND login_key=?",
      u.scope,
      key
    );
    if (!member || member.role === "admin" || u.role === "plantel" && (u.school !== member.school || member.role !== "estudiante"))
      fail(404, "Cuenta pendiente no encontrada en tu instituci\xF3n.");
    if (!member.must_change)
      fail(
        409,
        "Esta cuenta ya est\xE1 activa. Su titular puede recuperar la contrase\xF1a verificando su Google institucional vinculado."
      );
    const password = random(15), hash = await passwordHash(env2, u.scope, password);
    const rotated = await stmt(
      db,
      "UPDATE members SET password=? WHERE id=? AND must_change=1 AND password=? RETURNING id",
      hash,
      member.id,
      member.password
    ).first();
    if (!rotated)
      fail(
        409,
        "La credencial cambi\xF3 durante esta operaci\xF3n. Revisa el estado antes de reintentar."
      );
    await db.batch([
      stmt(db, "DELETE FROM sessions WHERE member=?", member.id),
      record(
        db,
        u,
        member.id,
        "Renovaci\xF3n de clave inicial",
        "Cuenta pendiente de activaci\xF3n"
      )
    ]);
    return { login: dni + "@pawtect.com", password, alias: member.alias };
  }

  // server/tickets.js
  var team = (u) => ["plantel", "psicologia", "equipo"].includes(u.role);
  function deskRoute(u) {
    return { plantel: "colegio", psicologia: "psicologia", equipo: "externa" }[u.role];
  }
  function handles(u, t) {
    return team(u) && t.route === deskRoute(u) && (u.school === "*" || u.school === t.school);
  }
  async function get(env2, u, id) {
    const t = await one(
      env2.DB,
      "SELECT * FROM tickets WHERE id=? AND scope=?",
      String(id || "").trim(),
      u.scope
    );
    if (!t || !(t.owner === u.id || handles(u, t)))
      fail(404, "No se encontr\xF3 el caso en tu espacio.");
    return t;
  }
  async function listTickets(env2, u) {
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
      env2.DB,
      common + q + " ORDER BY CASE t.priority WHEN 'Urgente' THEN 0 WHEN 'Alta' THEN 1 ELSE 2 END, t.updated DESC,t.id LIMIT 250",
      ...args
    );
  }
  async function describe(env2, u, id) {
    const t = await get(env2, u, id), db = env2.DB, staff = handles(u, t);
    const log = await rows(
      db,
      "SELECT id,label,body,internal,created FROM events WHERE ticket=? AND (internal=0 OR ?=1) ORDER BY created,id",
      t.id,
      staff ? 1 : 0
    );
    const files = await rows(
      db,
      "SELECT id,name,size FROM files WHERE ticket=?",
      t.id
    );
    const owner = await one(db, "SELECT alias FROM members WHERE id=?", t.owner);
    const assigned = t.assignee ? await one(db, "SELECT alias FROM members WHERE id=?", t.assignee) : null;
    const { scope, school, owner: privateId, assignee, ...safe } = t;
    return {
      ...safe,
      alias: owner.alias,
      assigned: assigned?.alias || "",
      staff,
      canIdentify: staff && (!!t.share_identity || t.priority === "Urgente"),
      events: log,
      files
    };
  }
  function priorityFor(raw, body, category) {
    const text = norm(body);
    if (raw === "Urgente" || /peligro inmediato|amenaza de muerte|me van a matar|arma de fuego|no quiero vivir|abuso sexual/.test(
      text
    ))
      return "Urgente";
    if (raw === "Alta" || ["Amenaza", "Acoso f\xEDsico"].includes(category))
      return "Alta";
    return "Normal";
  }
  async function checkedFiles(parts) {
    if (parts.length > 3 || parts.reduce((n, f) => n + f.size, 0) > 3 * 1024 * 1024)
      fail(400, "Adjunta hasta tres archivos con un total m\xE1ximo de 3 MB.");
    const checked = [];
    for (const f of parts) {
      if (typeof f.arrayBuffer !== "function" || f.size === 0)
        fail(400, "El archivo est\xE1 vac\xEDo.");
      const body = new Uint8Array(await f.arrayBuffer());
      const sig = Array.from(body.slice(0, 8)).join(",");
      const type = sig.startsWith("137,80,78,71,13,10,26,10") ? "image/png" : sig.startsWith("255,216,255") ? "image/jpeg" : sig.startsWith("37,80,68,70,45") ? "application/pdf" : null;
      if (!type || f.type !== type)
        fail(400, "Usa archivos JPG, PNG o PDF v\xE1lidos.");
      const ext = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "application/pdf": ".pdf"
      }[type];
      checked.push({
        body,
        mime: type,
        size: f.size,
        name: "Adjunto " + (checked.length + 1) + ext
      });
    }
    return checked;
  }
  async function newTicket(env2, u, b, parts) {
    role(u, "estudiante");
    await limited(env2.DB, "cases:" + u.id, 16, 3600);
    const kind = pick(b.kind, ["caso", "psicologia"]), actor = kind === "psicologia" ? "psicologia" : pick(b.actor, ["estudiante", "docente", "directivo", "otro"]);
    const subject = kind === "psicologia" ? "Consulta de psicolog\xEDa" : str(b.subject, 3, 100, "El t\xEDtulo"), body = str(b.body, 10, 5e3, "Tu mensaje");
    const category = kind === "psicologia" ? "Bienestar emocional" : pick(b.category, topics), priority = priorityFor(
      pick(b.priority || "Normal", priorities),
      body,
      category
    );
    const route = actor === "psicologia" ? "psicologia" : ["docente", "directivo"].includes(actor) ? "externa" : "colegio";
    if (!b.ack) fail(400, "Confirma que conoces qui\xE9n podr\xE1 leer el mensaje.");
    let familyAddress = "";
    if (b.family) {
      const info = await unseal(env2, u.scope, u.identity);
      familyAddress = info.family || "";
      if (!familyAddress)
        fail(400, "Tu cuenta a\xFAn no tiene un correo familiar autorizado.");
    }
    const requestId = b.requestId ? str(b.requestId, 36, 36, "El identificador del formulario") : uuid();
    const id = "PT-" + (await lookup(env2, u.scope, "case", u.id + "|" + requestId)).slice(0, 14).toUpperCase();
    const existing = () => one(
      env2.DB,
      "SELECT id,route,priority FROM tickets WHERE scope=? AND owner=? AND id=?",
      u.scope,
      u.id,
      id
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
      updated: now()
    };
    const files = await checkedFiles(parts);
    if (files.length && !env2.BUCKET)
      fail(503, "Los adjuntos no est\xE1n disponibles en este momento.");
    const ops = [
      insert(env2.DB, "tickets", t),
      record(env2.DB, u, t.id, "Ingreso de consulta", actor)
    ];
    const rec = await recipients(env2.DB, t);
    if (!rec.length && u.scope === "real")
      fail(
        409,
        "El colegio a\xFAn debe designar a una persona responsable de esta ruta. Puedes usar el canal oficial de S\xEDseVe."
      );
    ops.push(
      ...await notifyOps(
        env2,
        u.scope,
        rec,
        t.priority === "Urgente" ? "Caso urgente por revisar" : "Nueva consulta asignada",
        "Revisa la bandeja privada de tu equipo.",
        "/gestion.html",
        familyAddress
      )
    );
    const keys = [];
    try {
      for (const f of files) {
        const id2 = uuid(), key = u.scope + "/" + t.id + "/" + id2;
        await env2.BUCKET.put(key, f.body);
        keys.push(key);
        ops.push(
          insert(env2.DB, "files", {
            id: id2,
            ticket: t.id,
            storage_key: key,
            name: f.name,
            mime: f.mime,
            size: f.size
          })
        );
      }
      await env2.DB.batch(ops);
    } catch (e) {
      await Promise.allSettled(keys.map((k) => env2.BUCKET.delete(k)));
      const retry = await existing();
      if (retry) return retry;
      throw e;
    }
    return { id: t.id, route, priority };
  }
  async function ticketAction(env2, u, action, b) {
    if (action === "tickets") return { items: await listTickets(env2, u) };
    if (action === "lastMessage") {
      const t2 = await get(env2, u, b.id);
      const event = await one(
        env2.DB,
        "SELECT substr(body,1,161) AS excerpt,created,label,author FROM events WHERE ticket=? AND internal=0 ORDER BY created DESC,id DESC LIMIT 1",
        t2.id
      );
      if (!event) return { message: null };
      const letters = Array.from(event.excerpt);
      return {
        message: {
          text: letters.slice(0, 160).join("") + (letters.length > 160 ? "\u2026" : ""),
          at: event.created,
          from: event.author === u.id ? "T\xFA" : event.label
        }
      };
    }
    if (action === "ticket") return describe(env2, u, b.id);
    if (action === "file") {
      const f = await one(env2.DB, "SELECT * FROM files WHERE id=?", b.id || "");
      if (!f) fail(404, "No se encontr\xF3 el archivo.");
      const t2 = await get(env2, u, f.ticket);
      const data = await env2.BUCKET.get(f.storage_key);
      if (!data) fail(404, "El archivo no est\xE1 disponible.");
      await record(env2.DB, u, t2.id, "Descarga de adjunto", f.id).run();
      return new Response(data.body, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": 'attachment; filename="' + f.name + '"',
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'"
        }
      });
    }
    const t = await get(env2, u, b.id), db = env2.DB, staff = handles(u, t);
    if (action === "identify") {
      if (!staff || !t.share_identity && t.priority !== "Urgente")
        fail(
          403,
          "Esta apertura requiere autorizaci\xF3n del estudiante o una valoraci\xF3n urgente."
        );
      const reason = str(b.reason, 15, 500, "El motivo de acceso");
      const owner = await one(
        db,
        "SELECT identity FROM members WHERE id=?",
        t.owner
      );
      await db.batch([
        record(db, u, t.id, "Consulta de identidad", reason),
        note(
          db,
          t.owner,
          "Acceso a tu identidad",
          "El equipo registr\xF3 una consulta de identidad para tu caso.",
          "/casos.html?id=" + t.id
        )
      ]);
      const info = await unseal(env2, u.scope, owner.identity);
      return {
        name: info.name,
        grade: info.grade,
        email: info.email,
        dni: info.dni
      };
    }
    if (action === "export") {
      const d = await describe(env2, u, t.id);
      await record(
        db,
        u,
        t.id,
        "Copia de informe",
        "Copia de seguimiento sin identidad ni notas internas"
      ).run();
      return {
        ...d,
        events: d.events.filter((e) => !e.internal),
        files: [],
        body: d.body
      };
    }
    if (action === "event") {
      const body = str(b.body, 2, 3e3, "El mensaje"), internal = !!b.internal && staff;
      if (b.internal && !staff)
        fail(403, "Solo el equipo puede a\xF1adir notas internas.");
      const ops = [
        insert(db, "events", {
          id: uuid(),
          ticket: t.id,
          author: u.id,
          label: staff ? roles[u.role] : "Estudiante",
          body,
          internal: internal ? 1 : 0,
          created: now()
        }),
        stmt(db, "UPDATE tickets SET updated=? WHERE id=?", now(), t.id)
      ];
      if (!internal) {
        const rec = staff ? [await one(db, "SELECT id,identity FROM members WHERE id=?", t.owner)] : await recipients(db, t);
        ops.push(
          ...await notifyOps(
            env2,
            u.scope,
            rec,
            "Nuevo mensaje privado",
            "Tienes una actualizaci\xF3n en tu consulta.",
            (staff ? "/casos.html?id=" : "/gestion.html?id=") + t.id
          )
        );
      }
      await db.batch(ops);
      return { ok: true };
    }
    if (action === "manage") {
      if (!staff) fail(403, "Esta consulta est\xE1 a cargo de otro equipo.");
      const state = pick(b.state, states), priority = pick(b.priority, priorities), reason = str(b.reason, 5, 500, "La nota de seguimiento");
      await db.batch([
        stmt(
          db,
          "UPDATE tickets SET state=?,priority=?,assignee=?,updated=? WHERE id=?",
          state,
          priority,
          u.id,
          now(),
          t.id
        ),
        record(
          db,
          u,
          t.id,
          "Gesti\xF3n de caso",
          state + " \xB7 " + priority + " \xB7 " + reason
        ),
        insert(db, "events", {
          id: uuid(),
          ticket: t.id,
          author: u.id,
          label: roles[u.role],
          body: state + " \xB7 " + reason,
          internal: 0,
          created: now()
        }),
        ...await notifyOps(
          env2,
          u.scope,
          [await one(db, "SELECT id,identity FROM members WHERE id=?", t.owner)],
          "Cambi\xF3 el estado de tu caso",
          "Consulta los detalles en tu espacio.",
          "/casos.html?id=" + t.id
        )
      ]);
      return { ok: true };
    }
    fail(404, "Acci\xF3n de caso desconocida.");
  }

  // server/forum.js
  var mod = (u) => ["plantel", "equipo", "admin"].includes(u.role);
  var staffView = (u, school) => mod(u) && (u.school === "*" || u.school === school);
  function guard(u, write = false) {
    if (u.forum_until === -1 || write && u.forum_until > now())
      fail(
        403,
        u.forum_until === -1 ? "Tu acceso al foro est\xE1 suspendido. Puedes seguir pidiendo ayuda y usando psicolog\xEDa." : "Tu cuenta tiene una pausa temporal para publicar. Tu ayuda privada sigue disponible."
      );
  }
  async function visible(db, u, id) {
    const p = await one(
      db,
      "SELECT * FROM posts WHERE id=? AND scope=? AND school=? AND status='Visible'",
      String(id || ""),
      u.scope,
      u.school
    );
    if (!p) fail(404, "Esta publicaci\xF3n ya no est\xE1 disponible.");
    if (p.parent && !await one(
      db,
      "SELECT id FROM posts WHERE id=? AND status='Visible'",
      p.parent
    ))
      fail(404, "La conversaci\xF3n ya no est\xE1 disponible.");
    return p;
  }
  function assess(raw) {
    const s = norm(raw);
    if (/https?:\/\/|www\.|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|(?:\b\d[ -]?){8,}\b/.test(
      s
    ))
      return { level: "Revisi\xF3n", reason: "Posibles datos personales o enlaces" };
    if (/te voy a matar|amenaza de muerte|\b(porno\w*|nudes?|xxx)\b|voy a (golpearte|apalearte)|abuso sexual|no quiero vivir/.test(
      s
    ))
      return {
        level: "Grave",
        reason: "Posible amenaza, contenido expl\xEDcito o relato sensible"
      };
    if (/\b(idiota|imbecil|estupid[oa]|huevon|puta|mierda|pendej[oa]|maricon|peguenle|peleemos|hdp|ctm)\b|te espero a la salida|te voy a pegar/.test(
      s
    ))
      return {
        level: "Revisi\xF3n",
        reason: "Posible agresi\xF3n o relato de una experiencia"
      };
    return null;
  }
  var feedSelect = "SELECT p.id,p.category,p.title,p.body,p.created,m.alias,m.avatar,p.sample_hearts+(SELECT COUNT(*) FROM reactions r WHERE r.post=p.id AND r.kind='apoyo') AS hearts,(SELECT COUNT(*) FROM posts c WHERE c.parent=p.id AND c.status='Visible') AS comments,(SELECT COUNT(*) FROM reactions r WHERE r.post=p.id AND r.member=? AND r.kind='apoyo') AS liked,(SELECT COUNT(*) FROM reactions r WHERE r.post=p.id AND r.member=? AND r.kind='guardado') AS saved FROM posts p JOIN members m ON m.id=p.author ";
  async function forumAction(env2, u, action, b) {
    const db = env2.DB;
    if (action === "feed") {
      guard(u);
      const items = await rows(
        db,
        feedSelect + "WHERE p.scope=? AND p.school=? AND p.parent IS NULL AND p.status='Visible' ORDER BY p.created DESC,p.id LIMIT 100",
        u.id,
        u.id,
        u.scope,
        u.school
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
          p.id
        )
      };
    }
    if (action === "publish") {
      role(u, "estudiante");
      guard(u, true);
      await limited(db, "post:" + u.id, 20, 600);
      const body = str(b.body, 2, 1800, "Tu texto"), parent = b.parent ? await visible(db, u, b.parent) : null;
      if (parent?.parent) fail(400, "Responde a la publicaci\xF3n principal.");
      const title = parent ? "" : str(b.title, 3, 110, "El t\xEDtulo"), category = parent ? parent.category : pick(b.category, categories);
      const check = assess(title + " " + body), id = uuid(), ops = [
        insert(db, "posts", {
          id,
          scope: u.scope,
          school: u.school,
          author: u.id,
          parent: parent?.id || null,
          category,
          title,
          body,
          status: check ? "En revisi\xF3n" : "Visible",
          created: now()
        })
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
            created: now()
          })
        );
      } else if (parent && parent.author !== u.id)
        ops.push(
          note(
            db,
            parent.author,
            "Nueva respuesta",
            "Alguien respondi\xF3 a tu publicaci\xF3n.",
            "/foro.html?post=" + parent.id
          )
        );
      await db.batch(ops);
      return { id, held: !!check };
    }
    if (action === "reaction") {
      guard(u, true);
      const p = await visible(db, u, b.id), kind = pick(b.kind, ["apoyo", "guardado"]);
      if (b.on)
        await stmt(
          db,
          "INSERT INTO reactions(id,member,post,kind) VALUES(?,?,?,?) ON CONFLICT(member,post,kind) DO NOTHING",
          uuid(),
          u.id,
          p.id,
          kind
        ).run();
      else
        await stmt(
          db,
          "DELETE FROM reactions WHERE member=? AND post=? AND kind=?",
          u.id,
          p.id,
          kind
        ).run();
      return { ok: true };
    }
    if (action === "flag") {
      guard(u);
      await limited(db, "flag:" + u.id, 12, 600);
      const p = await visible(db, u, b.id), reason = str(b.reason, 6, 400, "El motivo");
      await stmt(
        db,
        "INSERT INTO reviews(id,scope,school,post,reporter,reason,level,state,created) VALUES(?,?,?,?,?,?,'Revisi\xF3n','Pendiente',?) ON CONFLICT(post,reporter) DO NOTHING",
        uuid(),
        u.scope,
        u.school,
        p.id,
        u.id,
        reason,
        now()
      ).run();
      return { ok: true };
    }
    if (!mod(u))
      fail(403, "Solo el equipo de moderaci\xF3n puede revisar incidentes.");
    if (action === "reviews") {
      return {
        items: await rows(
          db,
          "SELECT r.id,r.reason,r.level,r.state,r.decision,r.created,p.title,p.body,m.alias FROM reviews r JOIN posts p ON p.id=r.post JOIN members m ON m.id=p.author WHERE r.scope=? AND (r.school=? OR ?='*') ORDER BY CASE r.state WHEN 'Pendiente' THEN 0 ELSE 1 END,r.created DESC LIMIT 100",
          u.scope,
          u.school,
          u.school
        )
      };
    }
    const r = await one(
      db,
      "SELECT r.*,p.author FROM reviews r JOIN posts p ON p.id=r.post WHERE r.id=? AND r.scope=?",
      b.id || "",
      u.scope
    );
    if (!r || !staffView(u, r.school)) fail(404, "No se encontr\xF3 ese incidente.");
    if (action === "forumIdentity") {
      if (r.state !== "Resuelta" || r.decision !== "Expulsi\xF3n" || r.level !== "Grave")
        fail(403, "Se requiere una infracci\xF3n grave confirmada.");
      const reason = str(b.reason, 15, 450, "La justificaci\xF3n");
      await record(
        db,
        u,
        r.id,
        "Identificaci\xF3n por infracci\xF3n grave",
        reason
      ).run();
      const person = await one(
        db,
        "SELECT identity FROM members WHERE id=?",
        r.author
      );
      const info = await unseal(env2, u.scope, person.identity);
      return {
        name: info.name,
        dni: info.dni,
        grade: info.grade,
        email: info.email
      };
    }
    if (action === "moderate") {
      if (r.state !== "Pendiente")
        fail(409, "El equipo ya resolvi\xF3 este incidente.");
      let decision = pick(b.decision, [
        "Aprobar",
        "Retirar",
        "Advertencia",
        "Pausa de 24 h",
        "Pausa de 7 d\xEDas",
        "Expulsi\xF3n"
      ]);
      const level = pick(b.level, ["Revisi\xF3n", "Grave"]), reason = str(b.reason, 8, 450, "La justificaci\xF3n");
      if (decision === "Expulsi\xF3n" && level !== "Grave")
        fail(400, "Confirma la gravedad y documenta el motivo para expulsar.");
      const member = await one(
        db,
        "SELECT strikes,forum_until FROM members WHERE id=?",
        r.author
      );
      if (decision === "Advertencia" && member.strikes >= 2)
        decision = "Pausa de 24 h";
      const delta = { "Pausa de 24 h": 86400, "Pausa de 7 d\xEDas": 604800 }[decision];
      const until = decision === "Expulsi\xF3n" || member.forum_until === -1 ? -1 : Math.max(member.forum_until, delta ? now() + delta : 0);
      const sanctioned = !["Aprobar", "Retirar"].includes(decision);
      const ops = [
        stmt(
          db,
          "INSERT INTO audit(id,scope,actor,object,action,reason,created) VALUES ((SELECT 'mod-' || MIN(id) FROM reviews WHERE post=? AND state='Pendiente' AND EXISTS (SELECT id FROM reviews WHERE id=? AND state='Pendiente')),?,?,?,?,?,?)",
          r.post,
          r.id,
          u.scope,
          u.id,
          r.id,
          "Resoluci\xF3n del foro",
          decision + " \xB7 " + reason,
          now()
        ),
        stmt(
          db,
          "UPDATE reviews SET state='Resuelta',decision=?,level=? WHERE post=? AND state='Pendiente'",
          decision,
          level,
          r.post
        ),
        stmt(
          db,
          "UPDATE posts SET status=? WHERE id=?",
          decision === "Aprobar" ? "Visible" : "Retirada",
          r.post
        )
      ];
      if (sanctioned)
        ops.push(
          stmt(
            db,
            "UPDATE members SET strikes=strikes+1,forum_until=CASE WHEN forum_until=-1 OR ?=-1 THEN -1 WHEN forum_until>? THEN forum_until ELSE ? END WHERE id=?",
            until,
            until,
            until,
            r.author
          )
        );
      ops.push(
        note(
          db,
          r.author,
          "Revisi\xF3n de tu publicaci\xF3n",
          decision + " \xB7 " + reason,
          "/foro.html"
        )
      );
      if (decision === "Expulsi\xF3n") {
        const schoolTeam = await rows(
          db,
          "SELECT id,identity FROM members WHERE scope=? AND school=? AND role='plantel'",
          u.scope,
          r.school
        );
        ops.push(
          ...await notifyOps(
            env2,
            u.scope,
            schoolTeam,
            "Infracci\xF3n grave confirmada",
            "Revisa el incidente cerrado en Moderaci\xF3n.",
            "/gestion.html?tab=moderacion"
          )
        );
      }
      await db.batch(ops);
      return { decision };
    }
    fail(404, "Acci\xF3n del foro desconocida.");
  }

  // server/handler.js
  var auth = [
    "session",
    "login",
    "logout",
    "googleConfig",
    "googleLogin",
    "googleLink",
    "googleRecover",
    "demoRole",
    "password",
    "bootstrap"
  ];
  var forum = [
    "feed",
    "comments",
    "publish",
    "reaction",
    "flag",
    "reviews",
    "moderate",
    "forumIdentity"
  ];
  var cases = [
    "tickets",
    "lastMessage",
    "ticket",
    "event",
    "identify",
    "manage",
    "export",
    "file"
  ];
  var reads = /* @__PURE__ */ new Set([
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
    "googleConfig"
  ]);
  async function perform(req, env2, ctx) {
    const referer = req.headers.get("referer");
    if (!env2.LOCAL_PRACTICE && referer && new URL(referer, req.url).pathname.startsWith("/demo/"))
      fail(403, "La pr\xE1ctica funciona solo en tu navegador.");
    if (!env2.DB) fail(503, "La base de datos todav\xEDa no est\xE1 conectada.");
    const url = new URL(req.url), action = url.searchParams.get("action") || "";
    if (req.method === "POST") {
      const origin = req.headers.get("origin");
      if (!env2.LOCAL_PRACTICE && (!origin || origin !== url.origin))
        fail(403, "Abre el formulario desde el sitio de Pawtect.");
    } else if (req.method !== "GET" || !reads.has(action))
      fail(405, "Usa el formulario correspondiente para esta acci\xF3n.");
    const declared = Number(req.headers.get("content-length") || 0);
    if (declared > (action === "newTicket" ? 3.2 * 1024 * 1024 : 32768))
      fail(413, "El contenido supera el tama\xF1o permitido.");
    let b = Object.fromEntries(url.searchParams), parts = [];
    if (req.method === "POST") {
      if (action === "newTicket") {
        const form = await req.formData();
        try {
          b = JSON.parse(form.get("data") || "{}");
        } catch {
          fail(400, "Formulario inv\xE1lido.");
        }
        parts = form.getAll("files");
      } else {
        const body = await req.text();
        if (body.length > 32768) fail(413, "El contenido es demasiado largo.");
        try {
          b = JSON.parse(body || "{}");
        } catch {
          fail(400, "Formulario inv\xE1lido.");
        }
      }
    }
    const u = await current(env2, req), client = await sha(
      req.headers.get("cf-connecting-ip") || req.headers.get("x-vercel-forwarded-for") || "local"
    );
    if (auth.includes(action))
      return await authAction({ req, env: env2, u, client }, action, b);
    const publicCertificate = !u && !env2.LOCAL_PRACTICE && (action === "certLookup" || action === "certApply" && env2.PAWTECT_PILOT_OPEN === "1");
    if (!u && !publicCertificate) fail(401, "Tu sesi\xF3n termin\xF3. Entra de nuevo.");
    if (u?.must_change)
      fail(403, "Primero, cambia tu clave temporal en Mi cuenta.");
    let result;
    if (action === "newTicket") result = await newTicket(env2, u, b, parts);
    else if (cases.includes(action))
      result = await ticketAction(env2, u, action, b);
    else if (forum.includes(action))
      result = await forumAction(env2, u, action, b);
    else if (action === "notices")
      result = {
        items: await rows(
          env2.DB,
          "SELECT id,title,detail,url,seen,created FROM notifications WHERE member=? ORDER BY created DESC,id LIMIT 80",
          u.id
        )
      };
    else if (action === "markSeen") {
      await stmt(
        env2.DB,
        "UPDATE notifications SET seen=1 WHERE member=?",
        u.id
      ).run();
      result = { ok: true };
    } else if (action === "profile") {
      const p = await unseal(env2, u.scope, u.identity);
      result = {
        name: p.name,
        googleName: p.googleName || "",
        email: p.email,
        grade: p.grade,
        linked: !!u.google_key,
        hasFamily: !!p.family,
        hasPassword: !!u.password
      };
    } else if (action === "schools") {
      role(u, "plantel", "admin");
      result = {
        items: await rows(
          env2.DB,
          "SELECT id,name,domain FROM schools WHERE scope=? AND (id=? OR ?='admin') ORDER BY name",
          u.scope,
          u.school,
          u.role
        )
      };
    } else if (action === "schoolAdd") result = await createSchool(env2, u, b);
    else if (action === "memberAdd") result = await createMember(env2, u, b);
    else if (["rosterImport", "rosterLookup"].includes(action))
      result = await rosterAction(env2, u, action, b);
    else if (action === "renewInitial") result = await renewInitial(env2, u, b);
    else if (action === "certApply") {
      if (u?.role === "estudiante" && u.scope === "real")
        fail(403, "La solicitud debe enviarla el plantel o el equipo Pawtect.");
      const scope = u?.scope || "real";
      await limited(env2.DB, "cert:" + (u?.id || client), 8, 86400);
      const school = str(b.school, 3, 100, "El colegio"), contact = mail(b.email), name = str(b.name, 3, 80, "Tu nombre"), size = Number(b.size);
      if (!Number.isInteger(size) || size < 1 || size > 5e4 || !b.ack)
        fail(
          400,
          "Revisa el n\xFAmero de estudiantes y confirma tu representaci\xF3n."
        );
      const plan = pick(b.plan, ["Piloto gratuito", "Base", "Premium"]), id = "CE-" + uuid().slice(0, 12).toUpperCase(), trackingKey = random(18);
      const admins = await rows(
        env2.DB,
        "SELECT id,identity FROM members WHERE scope=? AND role='admin'",
        scope
      );
      if (scope === "real" && !admins.length)
        fail(409, "La recepci\xF3n de colegios est\xE1 pendiente de activaci\xF3n.");
      await env2.DB.batch([
        insert(env2.DB, "certifications", {
          id,
          scope,
          school,
          name: await seal(env2, scope, name),
          contact: await seal(env2, scope, contact),
          size,
          plan,
          requester: u?.id || null,
          status_key: await sha(trackingKey),
          state: "Recibida",
          created: now()
        }),
        ...await notifyOps(
          env2,
          scope,
          admins,
          "Solicitud de colegio",
          "Hay una nueva solicitud de certificaci\xF3n.",
          "/gestion.html?tab=colegios"
        )
      ]);
      result = { id, trackingKey };
    } else if (action === "certLookup") {
      await limited(env2.DB, "cert-lookup:" + client, 40, 900);
      const id = str(b.id, 3, 32, "El c\xF3digo").toUpperCase(), c = await one(
        env2.DB,
        "SELECT id,scope,school,requester,status_key,issued_at,state,plan,created FROM certifications WHERE id=?",
        id
      );
      const byAccount = c && u && u.scope === c.scope && (u.role === "admin" || u.id === c.requester);
      if (!c || c.scope !== (u?.scope || "real") || !byAccount && (!b.key || !same(await sha(String(b.key).trim()), c.status_key)))
        fail(404, "Revisa el c\xF3digo y la clave de consulta de tu solicitud.");
      result = {
        id: c.id,
        school: c.school,
        issued: c.issued_at,
        state: c.state,
        plan: c.plan,
        created: c.created
      };
    } else if (action === "certs") {
      role(u, "admin");
      const items = await rows(
        env2.DB,
        "SELECT * FROM certifications WHERE scope=? ORDER BY created DESC",
        u.scope
      );
      for (const c of items) {
        c.name = await unseal(env2, u.scope, c.name);
        c.contact = await unseal(env2, u.scope, c.contact);
        delete c.scope;
        delete c.status_key;
        delete c.requester;
      }
      result = { items };
    } else if (action === "certUpdate") {
      role(u, "admin");
      const state = pick(b.state, [
        "Recibida",
        "En evaluaci\xF3n",
        "Aprobada",
        "Observada"
      ]);
      const c = await one(
        env2.DB,
        "SELECT id,contact FROM certifications WHERE scope=? AND id=?",
        u.scope,
        b.id || ""
      );
      if (!c) fail(404, "Solicitud no encontrada.");
      await env2.DB.batch([
        stmt(
          env2.DB,
          "UPDATE certifications SET state=?,issued_at=CASE WHEN ?='Aprobada' THEN CASE WHEN issued_at>0 THEN issued_at ELSE ? END ELSE 0 END WHERE id=?",
          state,
          state,
          now(),
          c.id
        ),
        record(env2.DB, u, c.id, "Certificaci\xF3n", state),
        ...await notifyOps(
          env2,
          u.scope,
          [],
          "",
          "",
          "",
          await unseal(env2, u.scope, c.contact)
        )
      ]);
      result = { ok: true };
    } else if (action === "audit") {
      role(u, "admin");
      result = {
        items: await rows(
          env2.DB,
          "SELECT a.action,a.reason,a.object,a.created,m.alias FROM audit a JOIN members m ON m.id=a.actor WHERE a.scope=? ORDER BY a.created DESC LIMIT 100",
          u.scope
        )
      };
    } else if (action === "mailStatus") {
      role(u, "admin");
      result = {
        configured: !!(env2.EMAIL_FROM && env2.RESEND_API_KEY),
        review: Number(
          (await one(
            env2.DB,
            "SELECT COUNT(*) AS n FROM outbox WHERE scope=? AND state='Revisar'",
            u.scope
          )).n
        ),
        pending: Number(
          (await one(
            env2.DB,
            "SELECT COUNT(*) AS n FROM outbox WHERE scope=? AND state='Pendiente'",
            u.scope
          )).n
        ),
        sent: Number(
          (await one(
            env2.DB,
            "SELECT COUNT(*) AS n FROM outbox WHERE scope=? AND state='Enviado'",
            u.scope
          )).n
        )
      };
    } else if (action === "retryMail") {
      role(u, "admin");
      result = u.scope === "real" ? await deliver(env2) : { sent: 0, configured: false };
    } else fail(404, "La acci\xF3n solicitada no existe.");
    if ((u?.scope === "real" || publicCertificate) && [
      "newTicket",
      "manage",
      "event",
      "moderate",
      "certApply",
      "certUpdate"
    ].includes(action) && env2.RESEND_API_KEY) {
      const task = deliver(env2).catch(() => {
      });
      if (ctx?.waitUntil) ctx.waitUntil(task);
      else await task;
    }
    return result instanceof Response ? result : json(result);
  }
  async function handle(req, env2, ctx) {
    try {
      return await perform(req, env2, ctx);
    } catch (e) {
      if (!e.status) console.error("Pawtect request failed:", e.name);
      return json(
        {
          error: e.status ? e.message : "No pudimos completar la operaci\xF3n. Recarga el espacio y vuelve a intentarlo."
        },
        e.status || 500
      );
    }
  }

  // practice/seed.js
  async function seedPractice(env2) {
    const scope = "demo-" + uuid(), school = uuid(), db = env2.DB, members = {}, ops = [
      insert(db, "schools", {
        id: school,
        scope,
        name: "Colegio de muestra \xB7 Huancayo",
        domain: "colegio.example"
      })
    ];
    for (const key of [...Object.keys(roles), ...samplePosts.map((p) => p.key)]) {
      const sample = samplePosts.find((p) => p.key === key), r = sample ? "estudiante" : key;
      const u = {
        id: uuid(),
        scope,
        school,
        role: r,
        alias: sample?.alias || roleNames[r],
        avatar: sample?.avatar || (r === "estudiante" ? "menta" : "equipo"),
        identity: await seal(env2, scope, {
          name: sample ? "Estudiante de ejemplo" : roleNames[r] + " (ejemplo)",
          dni: "",
          grade: "Aula de muestra",
          email: "",
          family: ""
        }),
        login_key: null,
        inst_key: null,
        google_key: null,
        password: null,
        must_change: 0,
        forum_until: 0,
        strikes: 0
      };
      members[key] = u;
      ops.push(insert(db, "members", u));
    }
    for (const p of samplePosts) {
      const id = uuid(), t = now() - p.minutes * 60;
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
          sample_hearts: p.hearts
        })
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
            sample_hearts: 0
          })
        );
    }
    const ticket = {
      id: "PT-" + random(8).toUpperCase(),
      scope,
      school,
      owner: members.estudiante.id,
      kind: "caso",
      category: "Exclusi\xF3n",
      route: "colegio",
      priority: "Normal",
      subject: "Acompa\xF1amiento en el aula",
      body: "Ejemplo ficticio. Me gustar\xEDa conversar sobre c\xF3mo integrarme a un grupo de clase.",
      share_identity: 0,
      family: 0,
      state: "En revisi\xF3n",
      assignee: members.plantel.id,
      created: now() - 86400,
      updated: now() - 7200
    };
    ops.push(
      insert(db, "tickets", ticket),
      insert(db, "events", {
        id: uuid(),
        ticket: ticket.id,
        author: members.plantel.id,
        label: "Convivencia escolar",
        body: "Hemos le\xEDdo tu caso. Puedes escribirnos aqu\xED cuando te sientas listo.",
        internal: 0,
        created: ticket.updated
      }),
      note(
        db,
        members.estudiante.id,
        "Tu espacio de prueba",
        "Puedes recorrer el foro y probar un caso con datos ficticios.",
        "/casos.html"
      )
    );
    await db.batch(ops);
    const profile = {
      dni: "00000042",
      name: "\xC1lex Rivera",
      grade: "4.\xBA B",
      email: "alex@colegio.example",
      family: ""
    };
    await insert(db, "roster", {
      id: uuid(),
      scope,
      school,
      dni_key: await lookup(env2, scope, "login", profile.dni + "@pawtect.com"),
      inst_key: await lookup(env2, scope, "email", profile.email),
      identity: await seal(env2, scope, profile)
    }).run();
    return members.estudiante.id;
  }

  // drizzle/0000_sleepy_alice.sql
  var sleepy_alice_default = "CREATE TABLE `audit` (\n	`id` text PRIMARY KEY NOT NULL,\n	`scope` text NOT NULL,\n	`actor` text NOT NULL,\n	`object` text NOT NULL,\n	`action` text NOT NULL,\n	`reason` text NOT NULL,\n	`created` integer NOT NULL\n);\n--> statement-breakpoint\nCREATE INDEX `audit_scope` ON `audit` (`scope`,`created`);--> statement-breakpoint\nCREATE TABLE `certifications` (\n	`id` text PRIMARY KEY NOT NULL,\n	`scope` text NOT NULL,\n	`school` text NOT NULL,\n	`name` text NOT NULL,\n	`contact` text NOT NULL,\n	`size` integer NOT NULL,\n	`plan` text NOT NULL,\n	`state` text NOT NULL,\n	`created` integer NOT NULL\n);\n--> statement-breakpoint\nCREATE TABLE `events` (\n	`id` text PRIMARY KEY NOT NULL,\n	`ticket` text NOT NULL,\n	`author` text NOT NULL,\n	`label` text NOT NULL,\n	`body` text NOT NULL,\n	`internal` integer NOT NULL,\n	`created` integer NOT NULL\n);\n--> statement-breakpoint\nCREATE INDEX `ticket_events` ON `events` (`ticket`,`created`);--> statement-breakpoint\nCREATE TABLE `files` (\n	`id` text PRIMARY KEY NOT NULL,\n	`ticket` text NOT NULL,\n	`storage_key` text NOT NULL,\n	`name` text NOT NULL,\n	`mime` text NOT NULL,\n	`size` integer NOT NULL\n);\n--> statement-breakpoint\nCREATE INDEX `ticket_files` ON `files` (`ticket`);--> statement-breakpoint\nCREATE TABLE `limits` (\n	`id` text PRIMARY KEY NOT NULL,\n	`hits` integer NOT NULL,\n	`expires` integer NOT NULL\n);\n--> statement-breakpoint\nCREATE TABLE `members` (\n	`id` text PRIMARY KEY NOT NULL,\n	`scope` text NOT NULL,\n	`school` text NOT NULL,\n	`role` text NOT NULL,\n	`alias` text NOT NULL,\n	`avatar` text NOT NULL,\n	`identity` text NOT NULL,\n	`login_key` text,\n	`inst_key` text,\n	`google_key` text,\n	`password` text,\n	`must_change` integer DEFAULT 0 NOT NULL,\n	`forum_until` integer DEFAULT 0 NOT NULL,\n	`strikes` integer DEFAULT 0 NOT NULL\n);\n--> statement-breakpoint\nCREATE UNIQUE INDEX `member_login` ON `members` (`scope`,`login_key`);--> statement-breakpoint\nCREATE UNIQUE INDEX `member_email` ON `members` (`scope`,`inst_key`);--> statement-breakpoint\nCREATE UNIQUE INDEX `member_google` ON `members` (`scope`,`google_key`);--> statement-breakpoint\nCREATE INDEX `school_role` ON `members` (`scope`,`school`,`role`);--> statement-breakpoint\nCREATE TABLE `notifications` (\n	`id` text PRIMARY KEY NOT NULL,\n	`member` text NOT NULL,\n	`title` text NOT NULL,\n	`detail` text NOT NULL,\n	`url` text NOT NULL,\n	`seen` integer NOT NULL,\n	`created` integer NOT NULL\n);\n--> statement-breakpoint\nCREATE INDEX `member_notices` ON `notifications` (`member`,`created`);--> statement-breakpoint\nCREATE TABLE `outbox` (\n	`id` text PRIMARY KEY NOT NULL,\n	`scope` text NOT NULL,\n	`destination` text NOT NULL,\n	`state` text NOT NULL,\n	`created` integer NOT NULL\n);\n--> statement-breakpoint\nCREATE INDEX `pending_mail` ON `outbox` (`scope`,`state`,`created`);--> statement-breakpoint\nCREATE TABLE `posts` (\n	`id` text PRIMARY KEY NOT NULL,\n	`scope` text NOT NULL,\n	`school` text NOT NULL,\n	`author` text NOT NULL,\n	`parent` text,\n	`category` text NOT NULL,\n	`title` text NOT NULL,\n	`body` text NOT NULL,\n	`status` text NOT NULL,\n	`created` integer NOT NULL,\n	`sample_hearts` integer DEFAULT 0 NOT NULL\n);\n--> statement-breakpoint\nCREATE INDEX `post_feed` ON `posts` (`scope`,`school`,`status`,`created`);--> statement-breakpoint\nCREATE INDEX `thread_replies` ON `posts` (`parent`,`status`);--> statement-breakpoint\nCREATE TABLE `reactions` (\n	`id` text PRIMARY KEY NOT NULL,\n	`member` text NOT NULL,\n	`post` text NOT NULL,\n	`kind` text NOT NULL\n);\n--> statement-breakpoint\nCREATE UNIQUE INDEX `one_reaction` ON `reactions` (`member`,`post`,`kind`);--> statement-breakpoint\nCREATE TABLE `reviews` (\n	`id` text PRIMARY KEY NOT NULL,\n	`scope` text NOT NULL,\n	`school` text NOT NULL,\n	`post` text NOT NULL,\n	`reporter` text NOT NULL,\n	`reason` text NOT NULL,\n	`level` text NOT NULL,\n	`state` text NOT NULL,\n	`decision` text,\n	`created` integer NOT NULL\n);\n--> statement-breakpoint\nCREATE UNIQUE INDEX `one_report` ON `reviews` (`post`,`reporter`);--> statement-breakpoint\nCREATE INDEX `review_queue` ON `reviews` (`scope`,`school`,`state`);--> statement-breakpoint\nCREATE TABLE `schools` (\n	`id` text PRIMARY KEY NOT NULL,\n	`scope` text NOT NULL,\n	`name` text NOT NULL,\n	`domain` text NOT NULL\n);\n--> statement-breakpoint\nCREATE UNIQUE INDEX `school_domain` ON `schools` (`scope`,`domain`);--> statement-breakpoint\nCREATE TABLE `sessions` (\n	`token` text PRIMARY KEY NOT NULL,\n	`member` text NOT NULL,\n	`expires` integer NOT NULL,\n	`host_user` text NOT NULL\n);\n--> statement-breakpoint\nCREATE TABLE `tickets` (\n	`id` text PRIMARY KEY NOT NULL,\n	`scope` text NOT NULL,\n	`school` text NOT NULL,\n	`owner` text NOT NULL,\n	`kind` text NOT NULL,\n	`category` text NOT NULL,\n	`route` text NOT NULL,\n	`priority` text NOT NULL,\n	`subject` text NOT NULL,\n	`body` text NOT NULL,\n	`share_identity` integer NOT NULL,\n	`family` integer NOT NULL,\n	`state` text NOT NULL,\n	`assignee` text,\n	`created` integer NOT NULL,\n	`updated` integer NOT NULL\n);\n--> statement-breakpoint\nCREATE INDEX `ticket_queue` ON `tickets` (`scope`,`school`,`route`);--> statement-breakpoint\nCREATE INDEX `ticket_owner` ON `tickets` (`owner`,`updated`);";

  // drizzle/0001_special_giant_man.sql
  var special_giant_man_default = "ALTER TABLE `outbox` ADD `first_attempt` integer DEFAULT 0 NOT NULL;";

  // drizzle/0002_lying_nocturne.sql
  var lying_nocturne_default = "ALTER TABLE `certifications` ADD `requester` text;--> statement-breakpoint\nALTER TABLE `certifications` ADD `status_key` text;--> statement-breakpoint\nALTER TABLE `certifications` ADD `issued_at` integer DEFAULT 0 NOT NULL;";

  // drizzle/0003_tan_stature.sql
  var tan_stature_default = "CREATE TABLE `roster` (\n	`id` text PRIMARY KEY NOT NULL,\n	`scope` text NOT NULL,\n	`school` text NOT NULL,\n	`dni_key` text NOT NULL,\n	`inst_key` text NOT NULL,\n	`identity` text NOT NULL\n);\n--> statement-breakpoint\nCREATE UNIQUE INDEX `roster_dni` ON `roster` (`scope`,`dni_key`);--> statement-breakpoint\nCREATE UNIQUE INDEX `roster_email` ON `roster` (`scope`,`inst_key`);--> statement-breakpoint\nCREATE INDEX `roster_school` ON `roster` (`scope`,`school`);";

  // practice/worker.js
  importScripts("/practica-assets/sql-wasm.js");
  var database;
  var env;
  function bindings(sql) {
    class Statement {
      constructor(query, values = []) {
        this.query = query;
        this.values = values;
      }
      bind(...values) {
        return new Statement(this.query, values);
      }
      records() {
        const s = sql.prepare(this.query), result = [];
        try {
          s.bind(this.values);
          while (s.step()) result.push(s.getAsObject());
        } finally {
          s.free();
        }
        return result;
      }
      first() {
        return this.records()[0] ?? null;
      }
      all() {
        return { results: this.records() };
      }
      run() {
        return this.all();
      }
    }
    return {
      DB: {
        prepare: (q) => new Statement(q),
        batch: (ops) => {
          sql.run("BEGIN");
          try {
            const r = ops.map((op) => op.run());
            sql.run("COMMIT");
            return r;
          } catch (error) {
            sql.run("ROLLBACK");
            throw error;
          }
        }
      },
      BUCKET: {
        put(key, bytes2) {
          sql.run("INSERT INTO local_files(id,data) VALUES(?,?)", [
            key,
            new Uint8Array(bytes2)
          ]);
        },
        get(key) {
          const r = new Statement("SELECT data FROM local_files WHERE id=?", [
            key
          ]).first();
          return r ? { body: r.data } : null;
        },
        delete(key) {
          sql.run("DELETE FROM local_files WHERE id=?", [key]);
        }
      }
    };
  }
  async function initialize(payload) {
    const SQL = await self.initSqlJs({
      locateFile: () => "/practica-assets/sql-wasm.wasm"
    });
    database = new SQL.Database(payload.snapshot || void 0);
    env = {
      ...bindings(database),
      LOCAL_PRACTICE: { memberId: payload.memberId || "" }
    };
    if (!payload.snapshot) {
      for (const migration of [sleepy_alice_default, special_giant_man_default, lying_nocturne_default, tan_stature_default])
        database.run(migration);
      database.run("CREATE TABLE local_files(id TEXT PRIMARY KEY,data BLOB)");
      env.LOCAL_PRACTICE.memberId = await seedPractice(env);
    }
  }
  async function dispatch(payload) {
    if (!database) await initialize(payload);
    if (/^(google|bootstrap|logout)/.test(payload.action))
      throw Error(
        "Esta opci\xF3n corresponde al acceso institucional. Puedes cambiar de rol desde Mi cuenta."
      );
    const url = new URL("https://practica.invalid/api/pawtect");
    url.searchParams.set("action", payload.action);
    const options = { method: payload.method, headers: { Origin: url.origin } };
    if (payload.form) {
      options.body = new FormData();
      for (const [k, v] of payload.form) options.body.append(k, v);
    } else if (payload.method === "POST") {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(payload.data || {});
    } else
      for (const [k, v] of Object.entries(payload.data || {}))
        url.searchParams.set(k, v);
    const response = await handle(new Request(url, options), env);
    if (!response.ok) throw Error((await response.json()).error);
    const result = payload.action === "file" ? await response.blob() : await response.json();
    const persistent = payload.method === "POST" || !payload.snapshotSent || payload.action === "file";
    const snapshot = persistent ? database.export() : null;
    return { result, snapshot, memberId: env.LOCAL_PRACTICE.memberId };
  }
  var queue = Promise.resolve();
  self.onmessage = ({ data }) => {
    queue = queue.then(async () => {
      try {
        const answer = await dispatch(data);
        self.postMessage(
          { id: data.id, ...answer },
          answer.snapshot ? [answer.snapshot.buffer] : []
        );
      } catch (error) {
        self.postMessage({
          id: data.id,
          error: error.message || "No se pudo abrir la pr\xE1ctica."
        });
      }
    });
  };
})();
