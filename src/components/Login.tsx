"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function Login() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="login panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const data = new FormData(e.currentTarget);
        try {
          const r = await fetch("/api/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(Object.fromEntries(data)),
          });
          if (r.ok) router.refresh();
          else setError((await r.json()).error);
        } catch {
          setError("לא ניתן להתחבר כרגע");
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="muted">כניסה למנהלי האתר בלבד</p>
      <label>
        כתובת אימייל
        <input
          required
          type="email"
          name="email"
          autoComplete="username"
          dir="ltr"
        />
      </label>
      <label>
        סיסמה
        <input
          required
          type="password"
          name="password"
          autoComplete="current-password"
          dir="ltr"
          maxLength={256}
        />
      </label>
      <button disabled={busy} className="button">
        {busy ? "מתחברים…" : "כניסה לניהול"}
      </button>
      <p role="alert">{error}</p>
    </form>
  );
}
