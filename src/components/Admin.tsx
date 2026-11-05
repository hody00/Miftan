"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Listing } from "@/lib/listings";
import Modal from './Modal';
type Source = {
  id: string;
  name: string;
  url: string;
  approved: boolean;
  last_error: string | null;
  last_success_at: string | null;
};
type Job = {
  id: string;
  kind: string;
  status: string;
  error: string | null;
  created_at: string;
};
type Data = {
  counts:{total:number;published:number;review:number};
  listingPages:number;
  sources: Source[];
  jobs: Job[];
  listings: Listing[];
  state: {
    status: string;
    message: string;
    heartbeat: string;
    recovery_until: string | null;
  };
  removals: { id: string; listing_id: string; reason: string }[];
  quarantine: { id: string; reason: string; created_at: string }[];
};
const stateLabels: Record<string, string> = {
  starting: "מתחיל",
  idle: "מוכן",
  collecting: "אוסף מודעות",
  discovering: "מגלה קבוצות",
  needs_login: "נדרשת התחברות",
  recovery: "חלון שחזור פעיל",
  error: "נדרשת בדיקה",
  queued: "ממתין",
  running: "פועל",
  completed: "הושלם",
  failed: "נכשל",
  published: "מפורסם",
  review: "לבדיקה",
  hidden: "מוסתר",
  expired: "פג תוקף",
  sync: "איסוף",
  discover: "גילוי קבוצות",
  recover: "שחזור התחברות",
};
export default function Admin() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("sources");
  const [listingPage,setListingPage]=useState(1);
  const [editing, setEditing] = useState<Listing | null>(null);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin?page="+listingPage);
      if (r.status === 401) {
        router.refresh();
        return;
      }
      if (!r.ok) throw Error();
      setData(await r.json());
    } catch {
      setMessage("לא ניתן לטעון נתונים. ננסה שוב בקרוב.");
    }
  }, [router,listingPage]);
  useEffect(() => {
    void load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);
  async function act(body: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error);
      setMessage("הפעולה נשמרה בהצלחה");
      await load();
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "הפעולה נכשלה");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="admin-toolbar">
        <p className="muted">מקורות, בתים, וכל מה שקורה ביניהם.</p>
        <button
          className="button secondary small"
          onClick={async () => {
            await fetch("/api/auth", { method: "DELETE" });
            router.refresh();
          }}
        >
          התנתקות
        </button>
      </div>
      <p aria-live="polite" className="notice">
        {message}
      </p>
      {!data ? (
        <p role="status">טוענים את לוח הניהול…</p>
      ) : (
        <>
          <div className="stats">
            <div>
              <span>בתים פעילים</span>
              <b>
                {data.counts.published}
              </b>
            </div>
            <div>
              <span>קבוצות מאושרות</span>
              <b>{data.sources.filter((s) => s.approved).length}</b>
            </div>
            <div>
              <span>לבדיקת מנהל</span>
              <b>{data.counts.review}</b>
            </div>
            <div>
              <span>מצב האוסף</span>
              <b className="status-text">
                {Date.now() - new Date(data.state.heartbeat).getTime() > 120000
                  ? "לא מחובר"
                  : stateLabels[data.state.status] || data.state.status}
              </b>
            </div>
          </div>
          <section className="panel crawler-panel">
            <div>
              <h2>חיבור לפייסבוק</h2>
              <p>
                {data.state.message || "האוסף פועל ברקע עבור מקורות שאושרו."}
              </p>
              <small>
                עדכון אחרון:{" "}
                {new Date(data.state.heartbeat).toLocaleString("he-IL")}
              </small>
            </div>
            <div className="actions">
              <button
                disabled={busy}
                className="button secondary small"
                onClick={() => act({ action: "job", kind: "recover" })}
              >
                פתיחת חלון התחברות
              </button>
              {data.state.recovery_until &&
                new Date(data.state.recovery_until) > new Date() && (
                  <><a
                    className="button small"
                    href="http://localhost:6080/vnc.html?autoconnect=true&resize=scale"
                    target="_blank"
                    rel="noreferrer"
                  >
                    לחלון המקומי ↗
                  </a><button className="button secondary small" disabled={busy} onClick={()=>act({action:'resume'})}>סיימתי להתחבר — חזרה לאיסוף</button></>
                )}
              <button
                disabled={busy}
                className="button small"
                onClick={() => act({ action: "job", kind: "discover" })}
              >
                גילוי קבוצות
              </button>
              <button
                disabled={busy}
                className="button secondary small"
                onClick={() => act({ action: "job", kind: "sync" })}
              >
                סנכרון כעת
              </button>
            </div>
          </section>
          <div className="tabs" role="tablist" aria-label="ניהול">
            {[
              ["sources", "מקורות"],
              ["listings", "מודעות"],
              ["jobs", "פעילות"],
              ["removals", "בקשות הסרה"],
            ].map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "sources" && (
            <section className="panel">
              <h2>המקורות שלכם</h2>
              <p className="muted">
                גילוי קבוצות אינו מפעיל איסוף. אישור מקור כולל אישור לפרסום
                תוכנו באתר הציבורי.
              </p>
              <form
                className="source-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const d = new FormData(form);
                  if (
                    await act({
                      action: "source",
                      name: d.get("name"),
                      url: d.get("url"),
                    })
                  )
                    form.reset();
                }}
              >
                <label>
                  שם הקבוצה
                  <input name="name" required maxLength={150} />
                </label>
                <label>
                  קישור לקבוצה
                  <input
                    name="url"
                    type="url"
                    required
                    placeholder="https://www.facebook.com/groups/123/"
                    dir="ltr"
                  />
                </label>
                <button className="button small" disabled={busy}>
                  הוספת מקור
                </button>
              </form>
              {!data.sources.length ? (
                <p className="empty-inline">
                  עדיין אין קבוצות. הפעילו גילוי קבוצות או הוסיפו קישור.
                </p>
              ) : (
                data.sources.map((s) => (
                  <div className="source-row" key={s.id}>
                    <div>
                      <a href={s.url} target="_blank" rel="noreferrer">
                        <strong>{s.name} ↗</strong>
                      </a>
                      <p className="muted">
                        {s.last_success_at
                          ? "איסוף אחרון: " +
                            new Date(s.last_success_at).toLocaleString("he-IL")
                          : "טרם נאספו מודעות"}
                        {s.last_error ? " · " + s.last_error : ""}
                      </p>
                    </div>
                    <button
                      className="button secondary small"
                      disabled={busy}
                      onClick={() => {
                        if (
                          s.approved ||
                          window.confirm(
                            "אני מאשר/ת איסוף ופרסום ציבורי של תוכן הנכסים מקבוצה זו, בהתאם להרשאה שיש לי.",
                          )
                        )
                          void act({
                            action: "approve",
                            id: s.id,
                            approved: !s.approved,
                            confirmed: !s.approved,
                          });
                      }}
                    >
                      {s.approved ? "השהיית מקור" : "אישור איסוף ופרסום"}
                    </button>
                  </div>
                ))
              )}
            </section>
          )}
          {tab === "listings" && (
            <section className="panel">
              <h2>מודעות ועדכונים</h2>
              <nav className="pagination" aria-label="עמודי מודעות לניהול"><button className="button secondary small" disabled={listingPage===1} onClick={()=>setListingPage(p=>p-1)}>הקודם</button><span>עמוד {listingPage} מתוך {data.listingPages}</span><button className="button secondary small" disabled={listingPage>=data.listingPages} onClick={()=>setListingPage(p=>p+1)}>הבא</button></nav>
              <p className="muted">
                תיקונים ידניים נשמרים גם אחרי איסוף נוסף.
              </p>
              {!data.listings.length ? (
                <p className="empty-inline">
                  מודעות יופיעו כאן אחרי האיסוף הראשון.
                </p>
              ) : (
                data.listings.map((l) => (
                  <div className="source-row" key={l.id}>
                    <div>
                      <strong>{l.title}</strong>
                      <p className="muted">
                        {l.city || "מיקום לא ידוע"} · {stateLabels[l.status]}
                      </p>
                    </div>
                    <button
                      className="button secondary small"
                      onClick={() => setEditing(l)}
                    >
                      עריכה ופרסום
                    </button>
                  </div>
                ))
              )}
            </section>
          )}
          {tab === "jobs" && (
            <section className="panel">
              <h2>פעילות האוסף</h2>
              {data.jobs.map((j) => (
                <div className="source-row" key={j.id}>
                  <strong>
                    {stateLabels[j.kind]} · {stateLabels[j.status] || j.status}
                  </strong>
                  <span>
                    {new Date(j.created_at).toLocaleString("he-IL")}
                    {j.error ? " · " + j.error : ""}
                  </span>
                </div>
              ))}
              {!data.jobs.length && <p>עדיין אין פעילות.</p>}
              <h3>רשומות שלא ניתן היה לזהות</h3>
              <p className="muted">נשמרות לבדיקה ואינן מפורסמות.</p>
              {data.quarantine.map((q) => (
                <p key={q.id}>
                  {q.reason} ·{" "}
                  {new Date(q.created_at).toLocaleDateString("he-IL")}
                </p>
              ))}
            </section>
          )}
          {tab === "removals" && (
            <section className="panel">
              <h2>בקשות פתוחות</h2>
              {!data.removals.length ? (
                <p>אין בקשות פתוחות.</p>
              ) : (
                data.removals.map((r) => (
                  <div className="source-row" key={r.id}>
                    <p>{r.reason}</p>
                    <button
                      disabled={busy}
                      className="button small"
                      onClick={() => act({ action: "removal", id: r.id })}
                    >
                      הסתרת מודעה וסגירת בקשה
                    </button>
                  </div>
                ))
              )}
            </section>
          )}
          {editing && (
            <Modal onClose={()=>setEditing(null)}>
                <h2 id="edit-title">עריכת מודעה</h2>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const d = Object.fromEntries(new FormData(e.currentTarget));
                    const body = {
                      action: "listing",
                      id: editing.id,
                      ...d,
                      kind: d.kind || null,
                      city: d.city || null,
                      neighborhood: d.neighborhood || null,
                      ...Object.fromEntries(
                        ["price", "rooms", "area"].map((k) => [
                          k,
                          d[k] === "" ? null : Number(d[k]),
                        ]),
                      ),
                    };
                    if (await act(body)) setEditing(null);
                  }}
                >
                  <label>
                    כותרת
                    <input
                      name="title"
                      defaultValue={editing.title}
                      required
                      maxLength={200}
                    />
                  </label>
                  <div className="filter-grid">
                    <label>
                      סוג
                      <select name="kind" defaultValue={editing.kind || ""}>
                        <option value="">לא ידוע</option>
                        <option value="rent">השכרה</option>
                        <option value="sale">מכירה</option>
                      </select>
                    </label>
                    <label>
                      עיר
                      <input name="city" defaultValue={editing.city || ""} />
                    </label>
                    <label>
                      שכונה
                      <input
                        name="neighborhood"
                        defaultValue={editing.neighborhood || ""}
                      />
                    </label>
                    <label>
                      מחיר
                      <input
                        name="price"
                        type="number"
                        min="0"
                        defaultValue={editing.price || ""}
                      />
                    </label>
                    <label>
                      חדרים
                      <input
                        name="rooms"
                        type="number"
                        min="0"
                        max="30"
                        step="0.5"
                        defaultValue={editing.rooms || ""}
                      />
                    </label>
                    <label>
                      שטח
                      <input
                        name="area"
                        type="number"
                        min="0"
                        step="0.1"
                        defaultValue={editing.area || ""}
                      />
                    </label>
                  </div>
                  <label>
                    מצב
                    <select name="status" defaultValue={editing.status}>
                      {["published", "review", "hidden", "expired"].map((s) => (
                        <option key={s} value={s}>
                          {stateLabels[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="actions">
                    <button disabled={busy} className="button">
                      שמירת השינויים
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setEditing(null)}
                    >
                      ביטול
                    </button>
                  </div>
                </form>
            </Modal>
          )}
        </>
      )}
    </>
  );
}
