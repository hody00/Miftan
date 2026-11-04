'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="error-page"><h1>משהו השתבש בדרך</h1><p>לא הצלחנו להשלים את הבקשה. נסו שוב בעוד רגע.</p><button className="primary" onClick={reset}>ניסיון נוסף</button></main>;
}
