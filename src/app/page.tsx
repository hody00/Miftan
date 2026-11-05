import Link from "next/link";
import { getListings } from "@/lib/listings";
import { searchSchema } from "@/lib/search";
import Card from "@/components/Card";
import SearchForm from "@/components/SearchForm";
export const dynamic = "force-dynamic";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const values = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  const parsed = searchSchema.safeParse(values);
  let result: Awaited<ReturnType<typeof getListings>> | null = null;
  let unavailable = false;
  if (parsed.success) {
    try {
      result = await getListings(parsed.data);
    } catch {
      unavailable = true;
    }
  }
  function pageLink(page: number) {
    const p = new URLSearchParams(
      Object.entries(values).filter(
        (v): v is [string, string] => typeof v[1] === "string",
      ),
    );
    p.set("page", String(page));
    return "/?" + p.toString() + "#results";
  }
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span /> בתים. אנשים. התחלות חדשות.
          </div>
          <h1>
            המקום הבא שלכם.
            <br />
            <em>קצת יותר קרוב.</em>
          </h1>
          <p>
            הבתים שמסתתרים בין הפוסטים, במקום אחד.
            <br />
            פחות לחפש. יותר להרגיש בבית.
          </p>
          <div className="hero-note">
            <span>↙</span> הבית הבא מתחיל בחיבור קטן
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-sun" />
          <div className="arch">
            <div className="window">
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="plant">
              <b />
              <b />
              <b />
              <b />
              <span />
            </div>
            <div className="chair" />
            <div className="art-floor" />
          </div>
          <div className="art-label">
            <span>⌂</span>
            <div>
              יש מקום שמחכה לכם<small>בואו נמצא אותו יחד.</small>
            </div>
          </div>
          <div className="art-caption">A SPACE TO CALL YOUR OWN</div>
        </div>
      </section>
      <div className="content">
        <SearchForm values={values} />
        <div className="trust-row">
          <span>↗ ישירות מקבוצות הקהילה</span>
          <span>◷ מתעדכן לאורך היום</span>
          <span>♡ הבית שמתאים לכם, בקצב שלכם</span>
        </div>
        <section id="results" className="results">
          <div className="section-heading">
            <div>
              <span className="eyebrow">פותחים דלת לאפשרויות</span>
              <h2>
                {values.city
                  ? "הבתים ב" + values.city
                  : "אולי כאן מתחיל הפרק הבא"}
              </h2>
            </div>
            <span className="result-count">
              {result ? `${result.total} בתים בחיפוש` : "חיפוש בתים"}
            </span>
          </div>
          {!parsed.success ? (
            <div className="empty">
              <h3>נראה שאחד המסננים אינו תקין</h3>
              <p>בדקו את טווחי המחירים ומספר החדרים.</p>
              <Link className="button" href="/">
                איפוס החיפוש
              </Link>
            </div>
          ) : unavailable ? (
            <div className="empty" role="alert">
              <h3>אנחנו מתחברים מחדש</h3>
              <p>החיפוש אינו זמין כרגע. נסו שוב בעוד רגע.</p>
              <Link className="button" href="/">
                ניסיון נוסף
              </Link>
            </div>
          ) : result?.items.length ? (
            <>
              <div className="listing-grid">
                {result.items.map((l) => (
                  <Card key={l.id} listing={l} />
                ))}
              </div>
              <nav className="pagination" aria-label="עמודי תוצאות">
                {result.page > 1 && (
                  <Link href={pageLink(result.page - 1)}>→ הקודם</Link>
                )}
                <span>
                  עמוד {result.page} מתוך {result.pages}
                </span>
                {result.page < result.pages && (
                  <Link href={pageLink(result.page + 1)}>הבא ←</Link>
                )}
              </nav>
            </>
          ) : (
            <div className="empty">
              <div className="empty-icon">⌂</div>
              <h3>הבית שלכם עוד בדרך לכאן</h3>
              <p>
                אין כרגע בתים שמתאימים לחיפוש. אפשר להרחיב את המסננים
                <br />
                או לחזור אחרי העדכון הבא.
              </p>
              <Link className="button secondary" href="/">
                לכל הבתים
              </Link>
            </div>
          )}
        </section>
        <section className="closing">
          <span className="closing-icon">✳</span>
          <div>
            <h2>בית הוא יותר מארבעה קירות.</h2>
            <p>הוא השכונה, האור בבוקר, והתחושה שהגעתם למקום הנכון.</p>
          </div>
          <span className="closing-word">מפתן.</span>
        </section>
      </div>
    </>
  );
}
