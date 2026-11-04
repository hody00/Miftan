import { Brand } from '@/components/brand';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { signOut } from '@/app/actions';

export const dynamic = 'force-dynamic';
export default async function Dashboard({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { user } = await requireUser();
  const { error } = await searchParams;
  return <div className="dashboard">
    <header className="dashboard-header"><Brand /><div className="account"><span dir="ltr">{user.email}</span><form action={signOut}><button className="secondary">יציאה</button></form></div></header>
    <main className="dashboard-main"><span className="eyebrow">המרחב האישי שלכם</span><h1>כאן מתחיל החיפוש שלכם.</h1><p className="muted">מקום אחד לכל האפשרויות בדרך לבית הבא.</p>
      {error === 'logout' && <p role="alert" className="notice error">לא הצלחנו לנתק את החשבון. נסו שוב.</p>}
      <section className="empty-state"><h2>מוסיפים מקורות לחיפוש</h2><p>שמרו קבוצות ועמודים שתרצו לעקוב אחריהם בהמשך.</p><Link className="text-link" href="/sources">ניהול המקורות שלי</Link></section>
    </main><footer>מפתן · צעד קטן אל הבית הבא</footer>
  </div>;
}
