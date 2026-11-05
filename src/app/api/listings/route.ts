import { searchSchema } from "@/lib/search";
import { getListings } from "@/lib/listings";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const parsed = searchSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success)
    return Response.json({ error: "פרמטרי חיפוש לא תקינים" }, { status: 400 });
  try {
    return Response.json(await getListings(parsed.data));
  } catch {
    return Response.json({ error: "החיפוש אינו זמין כרגע" }, { status: 503 });
  }
}
