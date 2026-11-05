import Link from "next/link";
import type { Listing } from "@/lib/listings";
import { price } from "@/lib/format";
import Favorite from "./Favorite";
export default function Card({ listing: l }: { listing: Listing }) {
  return (
    <article className="card">
      <div className="card-image">
        <Link href={"/listing/" + l.id} tabIndex={-1} aria-hidden="true">
          {l.image_id ? (
            <img src={"/api/media/" + l.image_id} alt="" loading="lazy" />
          ) : (
            <div className="no-photo">
              <span>⌂</span>
              <small>עוד רגע מרגישים בבית</small>
            </div>
          )}
        </Link>
        <span className="badge">{l.kind === "sale" ? "למכירה" : l.kind === "rent" ? "להשכרה" : "סוג עסקה לא צוין"}</span>
        <Favorite id={l.id} />
      </div>
      <div className="card-body">
        <p className="location">
          {l.city || "מיקום לא צוין"}
          {l.neighborhood ? " · " + l.neighborhood : ""}
        </p>
        <h3>
          <Link href={"/listing/" + l.id}>{l.title}</Link>
        </h3>
        <div className="facts">
          <span>{l.rooms ? `${l.rooms} חדרים` : "חדרים לא צוינו"}</span>
          <span>{l.area ? `${l.area} מ״ר` : "שטח לא צוין"}</span>
        </div>
        <div className="card-bottom">
          <strong>
            {price(l.price)}
            {l.price && l.kind === "rent" && <small> / חודש</small>}
          </strong>
          <span>
            {new Date(l.published_at).toLocaleDateString("he-IL", {
              day: "numeric",
              month: "short",
              timeZone: "Asia/Jerusalem",
            })}
          </span>
        </div>
      </div>
    </article>
  );
}
