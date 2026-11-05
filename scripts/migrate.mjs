import pg from "pg";
import { readdir, readFile } from "node:fs/promises";
import { randomBytes, scryptSync } from "node:crypto";
const pool = new pg.Pool();
const client = await pool.connect();
try {
  await client.query("SELECT pg_advisory_lock(734192)");
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz DEFAULT now())",
  );
  for (const name of (await readdir(new URL("../migrations/", import.meta.url)))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    if (
      (
        await client.query("SELECT 1 FROM schema_migrations WHERE name=$1", [
          name,
        ])
      ).rowCount
    )
      continue;
    await client.query("BEGIN");
    try {
      await client.query(
        await readFile(
          new URL("../migrations/" + name, import.meta.url),
          "utf8",
        ),
      );
      await client.query("INSERT INTO schema_migrations(name) VALUES($1)", [
        name,
      ]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  }
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 16)
    throw new Error("ADMIN_PASSWORD must contain at least 16 characters");
  const salt = randomBytes(16).toString("hex");
  await client.query(
    "INSERT INTO admins(email,password_hash) VALUES($1,$2) ON CONFLICT(email) DO NOTHING",
    [
      (process.env.ADMIN_EMAIL || "admin@localhost").toLowerCase(),
      salt + ":" + scryptSync(password, salt, 64).toString("hex"),
    ],
  );
  console.log("Database ready");
} finally {
  await client.query("SELECT pg_advisory_unlock(734192)");
  client.release();
  await pool.end();
}
