import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { deleteSource, saveSource } from './actions';
import { ImportSources } from './import-sources';

export const dynamic = 'force-dynamic';

const messages: Record<string, string> = {
  saved: 'המקור נשמר.',
  imported: 'המקורות שסומנו נשמרו.',
  unselected: 'יש לסמן לפחות מקור אחד.',
  deleted: 'המקור הוסר.',
  invalid: 'יש להזין שם וקישור ישיר לקבוצה או לעמוד בפייסבוק.',
  duplicate: 'הקישור הזה כבר נמצא ברשימת המקורות שלכם.',
  failed: 'לא ניתן לעדכן את המקור. נסו שוב.',
};

type Source = { id: string; display_name: string; source_url: string; kind: string };

function SourceForm({ source }: { source?: Source }) {
  return <form className="fields source-form" action={saveSource}>
    {source && <input type="hidden" name="id" value={source.id} />}
    <label>שם המקור<input name="name" defaultValue={source?.display_name} maxLength={200} required /></label>
    <label>סוג המקור
      <select name="kind" defaultValue={source?.kind ?? 'group'}>
        <option value="group">קבוצה</option>
        <option value="page">עמוד</option>
      </select>
    </label>
    <label>קישור לפייסבוק
      <input type="url" name="url" dir="ltr" defaultValue={source?.source_url} maxLength={500} required />
    </label>
    <button className="secondary">{source ? 'שמירת שינויים' : 'הוספת מקור'}</button>
  </form>;
}

export default async function Sources({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { user, supabase } = await requireUser();
  const { status } = await searchParams;
  const { data, error } = await supabase.from('sources')
    .select('id, display_name, source_url, kind').eq('owner_id', user.id)
    .eq('provider', 'facebook').order('created_at', { ascending: false });

  return <main className="dashboard-main sources-page">
    <Link className="text-link" href="/dashboard">חזרה לדשבורד</Link>
    <h1>המקורות שלי</h1>
    <p>כאן שומרים קבוצות ועמודים מפייסבוק. איסוף פוסטים עדיין כבוי.</p>
    {status && Object.hasOwn(messages, status) && <p role="status">{messages[status]}</p>}
    <ImportSources existing={data?.map(source => source.source_url) ?? []} />
    <section className="source-card">
      <h2>הוספת מקור</h2>
      <SourceForm />
    </section>
    <section aria-label="מקורות שמורים">
      {error && <p role="alert">לא ניתן לטעון את המקורות. נסו לרענן את הדף.</p>}
      {!error && !data?.length && <p>עדיין אין מקורות שמורים.</p>}
      {data?.map((source) => <article key={source.id} className="source-card">
        <h2>{source.display_name}</h2>
        <p>{source.kind === 'group' ? 'קבוצה' : 'עמוד'} · איסוף כבוי</p>
        <p dir="ltr" className="source-url">{source.source_url}</p>
        <details>
          <summary>עריכת מקור</summary>
          <SourceForm source={source} />
        </details>
        <details>
          <summary>הסרת מקור</summary>
          <form action={deleteSource}>
            <input type="hidden" name="id" value={source.id} />
            <button className="secondary">אישור הסרה</button>
          </form>
        </details>
      </article>)}
    </section>
  </main>;
}
