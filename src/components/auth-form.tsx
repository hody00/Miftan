'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { submitAuth, signInWithGoogle } from '@/app/actions';
import type { AuthMode, AuthState } from '@/lib/auth-policy';

const labels = {
  login: { title: 'טוב לראות אתכם שוב', description: 'היכנסו למרחב האישי שלכם במפתן.', submit: 'כניסה לחשבון' },
  register: { title: 'הבית הבא מתחיל כאן', description: 'צרו חשבון כדי להתחיל את החיפוש שלכם.', submit: 'יצירת חשבון' },
  'forgot-password': { title: 'שכחתם את הסיסמה?', description: 'נשלח לכם קישור לבחירת סיסמה חדשה.', submit: 'שליחת קישור לאיפוס' },
  'reset-password': { title: 'בוחרים סיסמה חדשה', description: 'בחרו סיסמה אישית של 8 תווים לפחות.', submit: 'שמירת הסיסמה' },
};

export function AuthForm({ mode, initialError, googleEnabled, localInbox }: { mode: AuthMode; initialError?: string; googleEnabled: boolean; localInbox?: string }) {
  const [state, action, pending] = useActionState(submitAuth.bind(null, mode), {} as AuthState);
  const text = labels[mode];
  const isEntry = mode === 'login' || mode === 'register';
  return <section className="auth-panel" aria-labelledby="form-title">
    <span className="eyebrow">המקום שלכם, בקצב שלכם</span>
    <h1 id="form-title">{text.title}</h1>
    <p className="muted intro">{text.description}</p>
    {isEntry && <div className="auth-tabs" aria-label="גישה לחשבון">
      <Link href="/login" aria-current={mode === 'login' ? 'page' : undefined}>כניסה</Link>
      <Link href="/register" aria-current={mode === 'register' ? 'page' : undefined}>הרשמה</Link>
    </div>}
    <form action={action} className="fields">
      {mode !== 'reset-password' && <label htmlFor="email">כתובת דוא״ל
        <input id="email" name="email" type="email" dir="ltr" autoComplete="email" placeholder="you@example.com" required maxLength={254} />
      </label>}
      {mode !== 'forgot-password' && <div className="password-field"><label htmlFor="password">{mode === 'reset-password' ? 'סיסמה חדשה' : 'סיסמה'}
        <input id="password" name="password" type="password" dir="ltr" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} maxLength={128} aria-describedby="password-hint" />
      </label><span id="password-hint" className="field-hint">8 תווים לפחות</span></div>}
      {mode === 'login' && <Link className="text-link forgot" href="/forgot-password">שכחתם סיסמה?</Link>}
      {(state.error || initialError) && <p role="alert" className="notice error">{state.error || initialError}</p>}
      {state.message && <p role="status" className="notice success">
        {localInbox ? <>
          בדקו את תיבת הדוא״ל המקומית. בסביבת הפיתוח ההודעות מגיעות אליה בלבד.{' '}
          <a className="text-link" href={localInbox} target="_blank" rel="noreferrer">פתיחת תיבת הדוא״ל המקומית</a>
        </> : state.message}
      </p>}
      <button className="primary" type="submit" disabled={pending}>{pending ? 'רק רגע…' : text.submit}<span aria-hidden="true">←</span></button>
    </form>
    {isEntry && <>
      <div className="divider"><span>או</span></div>
      <form action={signInWithGoogle}><button className="google" disabled={!googleEnabled} type="submit"><span aria-hidden="true" className="google-letter">G</span> המשך עם Google</button></form>
      {!googleEnabled && <p className="field-hint google-note">כניסה עם Google תהיה זמינה בקרוב.</p>}
    </>}
    {!isEntry && <Link className="text-link return-link" href="/login">חזרה לכניסה</Link>}
    <p className="privacy-note"><span aria-hidden="true">◇</span> המרחב שלכם אישי. המידע נשאר פרטי.</p>
  </section>;
}
