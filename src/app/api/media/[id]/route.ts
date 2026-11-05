import { publicListing } from "@/lib/visibility";
import { query } from "@/lib/db";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { admin } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return new Response(null, { status: 404 });
  const isAdmin = await admin();
  const [img] = await query(
    `SELECT i.filename,i.mime FROM images i JOIN listings l ON l.id=i.listing_id WHERE i.id=$1 AND ($2 OR (${publicListing}))`,
    [id, !!isAdmin],
  );
  if (!img) return new Response(null, { status: 404 });
  try {
    const bytes = await readFile(
      /* turbopackIgnore: true */ path.join(
        /* turbopackIgnore: true */ process.env.IMAGE_ROOT ||
          "./.miftan-data/images",
        path.basename(img.filename),
      ),
    );
    return new Response(bytes, {
      headers: {
        "Content-Type": img.mime,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
