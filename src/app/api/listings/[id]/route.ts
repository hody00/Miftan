import { publicListing } from "@/lib/visibility";
import { query } from "@/lib/db";
import { z } from "zod";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return Response.json({ error: "Not found" }, { status: 404 });
  const [listing] = await query(
    `SELECT id,title,body,kind,city,neighborhood,price,rooms,area,amenities,published_at FROM listings l WHERE id=$1 AND ${publicListing}`,
    [id],
  );
  if (!listing) return Response.json({ error: "Not found" }, { status: 404 });
  const images = await query(
    "SELECT id,position FROM images WHERE listing_id=$1 ORDER BY position",
    [id],
  );
  const sources = await query(
    "SELECT p.url,s.name FROM posts p JOIN sources s ON s.id=p.source_id WHERE p.listing_id=$1 AND s.approved AND s.publication_confirmed",
    [id],
  );
  return Response.json(
    { ...listing, images, sources },
    { headers: { "Cache-Control": "no-store" } },
  );
}
