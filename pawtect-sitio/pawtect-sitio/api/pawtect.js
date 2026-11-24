import { neon } from "@neondatabase/serverless";
import { handle } from "../server/handler.js";

// The shared service only interpolates parameter markers and allowlisted table names.
function postgresQuery(text) {
  let index = 0;
  return text.replace(/\?/g, () => "$" + ++index);
}
export function neonBindings(sql) {
  class Statement {
    constructor(query, params = []) {
      this.query = query;
      this.params = params;
    }
    bind(...params) {
      return new Statement(this.query, params);
    }
    execute() {
      return sql.query(postgresQuery(this.query), this.params);
    }
    async first() {
      return (await this.execute())[0] || null;
    }
    async all() {
      return { results: await this.execute() };
    }
    async run() {
      return { results: await this.execute() };
    }
  }
  const DB = {
    prepare: (q) => new Statement(q),
    batch: (statements) => sql.transaction(statements.map((s) => s.execute())),
  };
  const BUCKET = {
    async put(key, bytes) {
      await sql.query(
        "INSERT INTO evidence_bytes(storage_key,data) VALUES($1,decode($2,'base64'))",
        [key, Buffer.from(bytes).toString("base64")],
      );
    },
    async get(key) {
      const [row] = await sql.query(
        "SELECT encode(data,'base64') AS content FROM evidence_bytes WHERE storage_key=$1",
        [key],
      );
      return row
        ? { body: new Uint8Array(Buffer.from(row.content, "base64")) }
        : null;
    },
    async delete(key) {
      await sql.query("DELETE FROM evidence_bytes WHERE storage_key=$1", [key]);
    },
  };
  return { DB, BUCKET };
}
let bindings;
export default {
  async fetch(request) {
    if (!process.env.DATABASE_URL)
      return Response.json(
        { error: "Configura DATABASE_URL en Vercel y vuelve a desplegar." },
        { status: 503 },
      );
    bindings ||= neonBindings(neon(process.env.DATABASE_URL));
    // Platform identity headers are trusted exclusively inside the Sites deployment.
    const headers = new Headers(request.headers);
    for (const name of [...headers.keys()])
      if (name.startsWith("oai-authenticated-") || name === "cf-connecting-ip")
        headers.delete(name);
    const sanitized = new Request(request, { headers });
    return handle(sanitized, { ...process.env, ...bindings });
  },
};
