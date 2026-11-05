import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty">
      <div className="empty-icon">⌂</div>
      <h1>הדלת הזו כבר נסגרה</h1>
      <p>המודעה אינה זמינה, או שהכתובת אינה קיימת.</p>
      <Link href="/" className="button">
        לבתים אחרים
      </Link>
    </div>
  );
}
