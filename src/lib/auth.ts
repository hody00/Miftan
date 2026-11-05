import { cookies } from "next/headers";
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { query } from "./db";
export const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function admin() {
  const token = (await cookies()).get("miftan_session")?.value;
  if (!token) return null;
  return (
    (
      await query(
        "SELECT a.id,a.email FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE token_hash=$1 AND expires_at>now()",
        [hash(token)],
      )
    )[0] ?? null
  );
}
export function sameOrigin(request: Request) {
  return (
    request.headers.get("origin") ===
    new URL(process.env.APP_URL || "http://localhost:3000").origin
  );
}
export function verifyPassword(password: string, stored: string) {
  const [salt, hex] = stored.split(":");
  const expected = Buffer.from(hex, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export async function createSession(id: string) {
  const token = randomBytes(32).toString("hex");
  await query(
    "INSERT INTO sessions(token_hash,admin_id,expires_at) VALUES($1,$2,now()+interval '12 hours')",
    [hash(token), id],
  );
  (await cookies()).set("miftan_session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: (process.env.APP_URL || "").startsWith("https:"),
    path: "/",
    maxAge: 43200,
  });
}
