import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "מפתן — המקום הבא שלכם", template: "%s · מפתן" },
  description:
    "מקום אחד לחיפוש בית. דירות להשכרה ולמכירה מקבוצות הקהילה, עם כל הפרטים שחשובים לכם.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <a className="skip" href="#main">
          דלגו לתוכן
        </a>
        <header className="header">
          <Link className="brand" href="/" aria-label="מפתן — עמוד הבית">
            <span className="brand-icon">מ</span>
            <span>
              מפתן<small>בית מתחיל בחיבור.</small>
            </span>
          </Link>
          <nav aria-label="ניווט ראשי">
            <Link href="/">למצוא בית</Link>
            <Link href="/favorites">
              הבתים ששמרתי <span aria-hidden>♡</span>
            </Link>
          </nav>
          <Link className="admin-link" href="/admin">
            כניסת מנהל <span aria-hidden>↗</span>
          </Link>
        </header>
        <main id="main">{children}</main>
        <footer>
          <Link className="brand footer-brand" href="/">
            מפתן<span className="dot">.</span>
          </Link>
          <p>הצעד הראשון אל המקום הבא שלכם.</p>
          <div>
            <Link href="/privacy">פרטיות והסרת תוכן</Link>
            <span>נבנה בשביל להרגיש בבית.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
