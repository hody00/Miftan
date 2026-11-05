import { publicListing } from "@/lib/visibility";
import { query } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return Response.json(
      await query(
        `SELECT DISTINCT city FROM listings l WHERE city IS NOT NULL AND ${publicListing} ORDER BY city`,
      ),
    );
  } catch {
    return Response.json({ error: "Unavailable" }, { status: 503 });
  }
}
