"use client";
import { useState } from "react";
export default function Removal({ id }: { id: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <details className="removal">
      <summary>דיווח על מודעה או בקשת הסרה</summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const form = new FormData(e.currentTarget);
          try {
            const r = await fetch("/api/removals", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                listing_id: id,
                reason: form.get("reason"),
              }),
            });
            const data = await r.json();
            setMessage(
              r.ok ? "הבקשה התקבלה ותיבדק על ידי מנהל האתר." : data.error,
            );
          } catch {
            setMessage("השליחה נכשלה. נסו שוב.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          מה כדאי שנדע?
          <textarea
            required
            minLength={10}
            maxLength={1000}
            name="reason"
            placeholder="נא לא לכלול פרטים אישיים רגישים"
          />
        </label>
        <button className="button small" disabled={busy}>
          שליחת בקשה
        </button>
        <p role="status">{message}</p>
      </form>
    </details>
  );
}
