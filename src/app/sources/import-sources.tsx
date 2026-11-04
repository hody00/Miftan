'use client';

import { useState } from 'react';
import { facebookSource } from './facebook-source';
import { importSources } from './actions';

type Candidate = { name: string; url: string; kind: 'group' | 'page' };

export function ImportSources({ existing }: { existing: string[] }) {
  const [items, setItems] = useState<Candidate[]>([]);
  const [message, setMessage] = useState('');

  async function load(file: File | undefined) {
    setItems([]);
    setMessage('');
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error();
      const rows: unknown = JSON.parse(await file.text());
      if (!Array.isArray(rows)) throw new Error();
      const seen = new Set(existing);
      const candidates: Candidate[] = [];
      for (const row of rows) {
        if (typeof row?.url !== 'string' || typeof row?.name !== 'string') continue;
        const source = facebookSource(row.url, row.kind);
        const name = row.name.trim().slice(0, 200);
        if (!source || !name || seen.has(source.url)) continue;
        seen.add(source.url);
        candidates.push({ ...source, name });
      }
      setItems(candidates);
      if (!candidates.length) setMessage('לא נמצאו מקורות חדשים בקובץ.');
    } catch {
      setMessage('לא ניתן לקרוא את קובץ המקורות.');
    }
  }

  return <section className="source-card">
    <h2>מקורות מוצעים</h2>
    <p>בחרי את קובץ ההצעות שיצר הכלי המקומי, ואז סמני את המקורות שתרצי להוסיף.</p>
    <label>קובץ הצעות<input type="file" accept=".json,application/json" onChange={event => void load(event.target.files?.[0])} /></label>
    {message && <p role="status">{message}</p>}
    {items.length > 0 && <form action={importSources}>
      {items.map(item => <label key={item.url} className="candidate">
        <input type="checkbox" name="candidate" value={JSON.stringify(item)} />
        <span>{item.name} · {item.kind === 'group' ? 'קבוצה' : 'עמוד'} <bdi>{item.url}</bdi></span>
      </label>)}
      <button className="secondary">הוספת מקורות שסומנו</button>
    </form>}
  </section>;
}
