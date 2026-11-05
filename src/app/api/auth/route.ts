import {
  admin,
  createSession,
  hash,
  sameOrigin,
  verifyPassword,
} from "@/lib/auth";
import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { readJson } from "@/lib/http";
import { z } from "zod";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Origin rejected" }, { status: 403 });
  const parsed = z.object({email:z.string().min(3).max(254).regex(/^[^@\s]+@[^@\s]+$/),password:z.string().max(256)}).safeParse(await readJson(request));
  if (!parsed.success)
    return Response.json({ error: "פרטים לא תקינים" }, { status: 400 });
  const body=parsed.data;
  const [globalAttempt] = await query("INSERT INTO login_attempts(key,attempts) VALUES('global',1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,window_start=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE login_attempts.window_start END RETURNING attempts");
  if(globalAttempt.attempts>100) return Response.json({error:'יותר מדי ניסיונות. נסו שוב מאוחר יותר.'},{status:429});
  const email = body.email.toLowerCase().trim().slice(0, 254);
  const key = hash(email);
  const [attempt] = await query(
    "INSERT INTO login_attempts(key,attempts) VALUES($1,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,window_start=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE login_attempts.window_start END RETURNING attempts",
    [key],
  );
  if (attempt.attempts > 8)
    return Response.json(
      { error: "יותר מדי ניסיונות. נסו שוב בעוד 15 דקות." },
      { status: 429 },
    );
  const [user] = await query("SELECT * FROM admins WHERE email=$1", [email]);
  const dummy = "00000000000000000000000000000000:" + "00".repeat(64);
  const valid = verifyPassword(body.password, user?.password_hash || dummy);
  if (!user || !valid)
    return Response.json(
      { error: "כתובת האימייל או הסיסמה שגויות" },
      { status: 401 },
    );
  await createSession(user.id);
  await query("DELETE FROM login_attempts WHERE key=$1", [key]);
  return Response.json({ ok: true });
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request) || !(await admin()))
    return Response.json({ error: "Forbidden" }, { status: 403 });
  const jar = await cookies();
  await query("DELETE FROM sessions WHERE token_hash=$1", [
    hash(jar.get("miftan_session")!.value),
  ]);
  jar.delete("miftan_session");
  return Response.json({ ok: true });
}
