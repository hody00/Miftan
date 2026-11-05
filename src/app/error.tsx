"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty">
      <h1>משהו השתבש בדרך</h1>
      <p>נסו שוב בעוד רגע.</p>
      <button className="button" onClick={reset}>
        ניסיון נוסף
      </button>
    </div>
  );
}
