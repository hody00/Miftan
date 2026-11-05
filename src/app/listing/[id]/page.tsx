import { publicListing } from "@/lib/visibility";
import { query } from "@/lib/db";
import { Listing, price } from "@/lib/listings";
import { notFound } from "next/navigation";
import { z } from "zod";
import Favorite from "@/components/Favorite";
import Removal from "@/components/Removal";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function Detail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [l] = await query<Listing>(
    `SELECT * FROM listings l WHERE id=$1 AND ${publicListing}`,
    [id],
  );
  if (!l) notFound();
  const images = await query(
    "SELECT id FROM images WHERE listing_id=$1 ORDER BY position",
    [id],
  );
  const sources = await query(
    "SELECT p.url,s.name FROM posts p JOIN sources s ON s.id=p.source_id WHERE p.listing_id=$1 AND s.approved AND s.publication_confirmed",
    [id],
  );
  return (
    <div className="content page-content">
      <Link className="back" href="/">
        → בחזרה לחיפוש
      </Link>
      <div className="detail-heading">
        <div>
          <span className="eyebrow">
            {l.kind === "rent" ? "להשכרה" : l.kind === "sale" ? "למכירה" : "סוג עסקה לא צוין"} ·{" "}
            {l.city || "מיקום לא צוין"}
          </span>
          <h1>{l.title}</h1>
          <p className="muted">
            {l.neighborhood || l.city} · פורסם ב־
            {new Date(l.published_at).toLocaleDateString("he-IL", {
              timeZone: "Asia/Jerusalem",
            })}
          </p>
        </div>
        <Favorite id={id} />
      </div>
      <div className="gallery">
        {images.length ? (
          images.map((im, i) => (
            <a
              href={"/api/media/" + im.id}
              target="_blank"
              rel="noreferrer"
              key={im.id}
            >
              <img
                src={"/api/media/" + im.id}
                alt={`תמונת הנכס ${i + 1}`}
                loading={i ? "lazy" : "eager"}
              />
            </a>
          ))
        ) : (
          <div className="no-photo">
            <span>⌂</span>
            <p>לא צורפו תמונות לנכס</p>
          </div>
        )}
      </div>
      <div className="detail-columns">
        <section>
          <h2>קצת על הבית</h2>
          <div className="detail-facts">
            <span>
              <b>{l.rooms || "—"}</b>חדרים
            </span>
            <span>
              <b>{l.area || "—"}</b>מ״ר
            </span>
            <span>
              <b>{l.kind === "rent" ? "השכרה" : l.kind === "sale" ? "מכירה" : "לא צוין"}</b>סוג העסקה
            </span>
          </div>
          <div className="amenities">
            {Object.entries(l.amenities || {})
              .filter(([, v]) => v)
              .map(([k]) => (
                <span key={k}>
                  ✓{" "}
                  {(
                    {
                      balcony: "מרפסת",
                      parking: "חניה",
                      elevator: "מעלית",
                      shelter: "ממ״ד",
                      furnished: "מרוהטת",
                    } as Record<string, string>
                  )[k] || k}
                </span>
              ))}
          </div>
          <p className="listing-text">{l.body}</p>
          <Removal id={id} />
        </section>
        <aside className="contact-card">
          <span className="eyebrow">הצעד הבא שלכם</span>
          <h2>{price(l.price)}</h2>
          {l.kind === "rent" && l.price && <p className="muted">לחודש</p>}
          <p>כל הפרטים והשיחה עם המפרסם נמצאים בפוסט המקורי.</p>
          {sources.map((s, i) => (
            <a
              className={i ? "source-link" : "button"}
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {i ? s.name : "למודעה המקורית"} ↗
            </a>
          ))}
          <small>
            הפרטים חולצו אוטומטית. מומלץ לוודא זמינות ודיוק מול המפרסם.
          </small>
        </aside>
      </div>
    </div>
  );
}
