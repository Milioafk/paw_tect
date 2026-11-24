-- Solo para la versión anterior de Pawtect con las tablas members, tickets y certifications.
-- Conserva los registros anteriores. Puede ejecutarse de nuevo.
BEGIN;
CREATE TABLE IF NOT EXISTS "roster" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"school" text NOT NULL,
	"dni_key" text NOT NULL,
	"inst_key" text NOT NULL,
	"identity" text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "roster_dni" ON "roster" ("scope","dni_key");
CREATE UNIQUE INDEX IF NOT EXISTS "roster_email" ON "roster" ("scope","inst_key");
CREATE INDEX IF NOT EXISTS "roster_school" ON "roster" ("scope","school");
COMMIT;
