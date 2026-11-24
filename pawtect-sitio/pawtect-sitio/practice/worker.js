import { handle } from "../server/handler.js";
import { seedPractice } from "./seed.js";
import base from "../drizzle/0000_sleepy_alice.sql";
import mail from "../drizzle/0001_special_giant_man.sql";
import cert from "../drizzle/0002_lying_nocturne.sql";
import enrollment from "../drizzle/0003_tan_stature.sql";

importScripts("/practica-assets/sql-wasm.js");
let database, env;
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
      const s = sql.prepare(this.query),
        result = [];
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
      },
    },
    BUCKET: {
      put(key, bytes) {
        sql.run("INSERT INTO local_files(id,data) VALUES(?,?)", [
          key,
          new Uint8Array(bytes),
        ]);
      },
      get(key) {
        const r = new Statement("SELECT data FROM local_files WHERE id=?", [
          key,
        ]).first();
        return r ? { body: r.data } : null;
      },
      delete(key) {
        sql.run("DELETE FROM local_files WHERE id=?", [key]);
      },
    },
  };
}
async function initialize(payload) {
  const SQL = await self.initSqlJs({
    locateFile: () => "/practica-assets/sql-wasm.wasm",
  });
  database = new SQL.Database(payload.snapshot || undefined);
  env = {
    ...bindings(database),
    LOCAL_PRACTICE: { memberId: payload.memberId || "" },
  };
  if (!payload.snapshot) {
    for (const migration of [base, mail, cert, enrollment])
      database.run(migration);
    database.run("CREATE TABLE local_files(id TEXT PRIMARY KEY,data BLOB)");
    env.LOCAL_PRACTICE.memberId = await seedPractice(env);
  }
}
async function dispatch(payload) {
  if (!database) await initialize(payload);
  if (/^(google|bootstrap|logout)/.test(payload.action))
    throw Error(
      "Esta opción corresponde al acceso institucional. Puedes cambiar de rol desde Mi cuenta.",
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
  const result =
    payload.action === "file" ? await response.blob() : await response.json();
  const persistent =
    payload.method === "POST" ||
    !payload.snapshotSent ||
    payload.action === "file";
  const snapshot = persistent ? database.export() : null;
  return { result, snapshot, memberId: env.LOCAL_PRACTICE.memberId };
}
let queue = Promise.resolve();
self.onmessage = ({ data }) => {
  queue = queue.then(async () => {
    try {
      const answer = await dispatch(data);
      self.postMessage(
        { id: data.id, ...answer },
        answer.snapshot ? [answer.snapshot.buffer] : [],
      );
    } catch (error) {
      self.postMessage({
        id: data.id,
        error: error.message || "No se pudo abrir la práctica.",
      });
    }
  });
};
