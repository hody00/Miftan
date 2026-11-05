import { admin, sameOrigin } from "@/lib/auth";
import { query } from "@/lib/db";
import { z } from "zod";
import { readJson } from "@/lib/http";
export const dynamic = "force-dynamic";
const action = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("source"),
    url: z.url().max(300),
    name: z.string().min(1).max(150),
  }),
  z.object({
    action: z.literal("approve"),
    id: z.uuid(),
    approved: z.boolean(),
    confirmed: z.boolean(),
  }),
  z.object({
    action: z.literal("job"),
    kind: z.enum(["discover", "sync", "recover"]),
    source_id: z.uuid().optional(),
  }),
  z.object({
    action: z.literal("listing"),
    id: z.uuid(),
    status: z.enum(["published", "review", "hidden", "expired"]),
    title: z.string().min(1).max(200),
    kind: z.enum(["rent", "sale"]).nullable(),
    city: z.string().max(80).nullable(),
    neighborhood: z.string().max(80).nullable(),
    price: z.number().nonnegative().max(1000000000).nullable(),
    rooms: z.number().nonnegative().max(30).nullable(),
    area: z.number().nonnegative().max(100000).nullable(),
  }),
  z.object({ action: z.literal("removal"), id: z.uuid() }),
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("disconnect") }),
]);
export async function GET(request:Request) {
  if (!(await admin()))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const page=z.coerce.number().int().min(1).max(100000).catch(1).parse(new URL(request.url).searchParams.get('page')||1);
  const [sources, jobs, listings, state, removals, quarantine,counts] =
    await Promise.all([
      query("SELECT * FROM sources ORDER BY created_at DESC"),
      query("SELECT * FROM jobs ORDER BY created_at DESC LIMIT 30"),
      query("SELECT * FROM listings ORDER BY updated_at DESC,id LIMIT 100 OFFSET $1",[(page-1)*100]),
      query("SELECT * FROM crawler_state"),
      query(
        "SELECT * FROM removal_requests WHERE status='open' ORDER BY created_at DESC",
      ),
      query(
        "SELECT id,source_id,reason,created_at FROM quarantine ORDER BY created_at DESC LIMIT 30",
      ),
      query("SELECT count(*)::int total,count(*) FILTER(WHERE status='published' AND expires_at>now())::int published,count(*) FILTER(WHERE status='review')::int review FROM listings"),
    ]);
  return Response.json(
    { sources, jobs, listings, state: state[0], removals, quarantine,counts:counts[0],listingPages:Math.max(1,Math.ceil(counts[0].total/100)) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  if (!sameOrigin(request) || !(await admin()))
    return Response.json({ error: "Forbidden" }, { status: 403 });
  const parsed = action.safeParse(await readJson(request));
  if (!parsed.success)
    return Response.json({ error: "נתונים לא תקינים" }, { status: 400 });
  const a = parsed.data;
  try {
    if (a.action === 'disconnect') {
      await query("UPDATE crawler_state SET facebook_connected=false,disconnect_requested=true,recovery_until=NULL,message='מנתק את חשבון הפייסבוק…' WHERE id=1");
      return Response.json({ok:true});
    }
    if (a.action === 'source' || a.action === 'approve' || (a.action === 'job' && a.kind !== 'recover')) {
      const [connection]=await query("SELECT facebook_connected,disconnect_requested,recovery_until FROM crawler_state WHERE id=1");
      if (!connection?.facebook_connected || connection.disconnect_requested || connection.recovery_until)
        return Response.json({error:'יש להתחבר לפייסבוק לפני ניהול מקורות או איסוף'}, {status:409});
    }
    if (a.action === 'job' && a.kind === 'recover') {
      const [connection]=await query("SELECT disconnect_requested,recovery_until FROM crawler_state WHERE id=1");
      if(connection?.disconnect_requested || connection?.recovery_until)
        return Response.json({error:'יש להמתין לסיום הפעולה הנוכחית'}, {status:409});
    }
    if (a.action === "resume") await query("UPDATE crawler_state SET recovery_until=now() WHERE id=1");
    if (a.action === "source") {
      const url = new URL(a.url);
      const match = url.pathname.match(/^\/groups\/(\d+)\/?$/);
      if (
        !["www.facebook.com", "facebook.com"].includes(url.hostname) ||
        url.protocol !== "https:" ||
        !match
      )
        return Response.json(
          { error: "יש להזין קישור לקבוצה עם מזהה מספרי" },
          { status: 400 },
        );
      await query(
        "INSERT INTO sources(external_id,name,url) VALUES($1,$2,$3) ON CONFLICT(external_id) DO UPDATE SET name=EXCLUDED.name",
        [match[1], a.name, `https://www.facebook.com/groups/${match[1]}/`],
      );
    }
    if (a.action === "approve") {
      if (a.approved && !a.confirmed)
        return Response.json({ error: "נדרש אישור פרסום" }, { status: 400 });
      await query(
        "UPDATE sources SET approved=$2,publication_confirmed=$3,next_run_at=now() WHERE id=$1",
        [a.id, a.approved, a.confirmed],
      );
    }
    if (a.action === "job")
      await query(
        "INSERT INTO jobs(kind,source_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [a.kind, a.source_id ?? null],
      );
    if (a.action === "listing") {
      const { action: _, id, status, ...fields } = a;
      await query(
        "UPDATE listings SET title=$2,kind=$3,city=$4,neighborhood=$5,price=$6,rooms=$7,area=$8,status=$9,overrides=overrides || $10::jsonb,updated_at=now(),expires_at=CASE WHEN $9='published' THEN now()+interval '30 days' ELSE expires_at END WHERE id=$1",
        [
          id,
          a.title,
          a.kind,
          a.city,
          a.neighborhood,
          a.price,
          a.rooms,
          a.area,
          status,
          JSON.stringify({ ...fields, status }),
        ],
      );
    }
    if (a.action === "removal") {
      await query(
        "WITH removed AS (UPDATE listings SET status='hidden',overrides=overrides || '{\"status\":\"hidden\"}'::jsonb WHERE id=(SELECT listing_id FROM removal_requests WHERE id=$1)) UPDATE removal_requests SET status='resolved' WHERE id=$1",
        [a.id],
      );
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "הפעולה נכשלה. נסו שוב." }, { status: 500 });
  }
}
