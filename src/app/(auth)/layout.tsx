import { Brand } from '@/components/brand';
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="auth-shell">
    <div className="auth-main"><header><Brand /></header><div className="form-wrap">{children}</div><footer>מפתן · צעד קטן אל הבית הבא</footer></div>
    <aside className="story-panel" aria-label="ברוכים הבאים למפתן">
      <span className="story-kicker">פותחים דלת לאפשרויות חדשות</span>
      <div className="door-scene" aria-hidden="true"><div className="sun" /><div className="arch"><div className="door"><i /></div></div><div className="step step-one" /><div className="step step-two" /><div className="plant"><i /><i /><i /><b /></div></div>
      <div className="story-copy"><span className="small-rule" /><h2>יש מקום<br />שמחכה לכם.</h2><p>כל חיפוש מתחיל בצעד אחד.<br />הבית הבא שלכם מתחיל במפתן.</p></div>
      <span className="story-bottom">פחות לחפש. יותר להרגיש בבית.</span>
    </aside>
  </main>;
}
