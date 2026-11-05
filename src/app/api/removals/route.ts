import { query } from "@/lib/db";
import { sameOrigin } from "@/lib/auth";
import { z } from "zod";
import { readJson } from "@/lib/http";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Forbidden" }, { status: 403 });
  const parsed = z
    .object({
      listing_id: z.uuid(),
      reason: z.string().min(10).max(1000),
      website: z.string().max(0).optional(),
    })
    .safeParse(await readJson(request));
  if (!parsed.success)
    return Response.json(
      { error: "יש לתאר את הבקשה ב־10 תווים לפחות" },
      { status: 400 },
    );
  const { listing_id, reason } = parsed.data;
  const result = await query(
    "INSERT INTO removal_requests(listing_id,reason) SELECT id,$2 FROM listings WHERE id=$1 AND NOT EXISTS(SELECT 1 FROM removal_requests WHERE listing_id=$1 AND status='open') RETURNING id",
    [listing_id, reason],
  );
  return Response.json({ ok: true, created: !!result.length });
}
