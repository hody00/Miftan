'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { facebookSource } from './facebook-source';

export async function importSources(form: FormData) {
  const { user, supabase } = await requireUser();
  const candidates = form.getAll('candidate');
  if (!candidates.length) redirect('/sources?status=unselected');
  const rows = new Map();
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') redirect('/sources?status=invalid');
    let item;
    try {
      item = JSON.parse(candidate);
    } catch {
      redirect('/sources?status=invalid');
    }
    const source = typeof item?.url === 'string' && facebookSource(item.url, item.kind);
    const name = typeof item?.name === 'string' ? item.name.trim() : '';
    if (!source || !name || name.length > 200) redirect('/sources?status=invalid');
    rows.set(source.url, {
      owner_id: user.id, provider: 'facebook', kind: source.kind,
      source_url: source.url, display_name: name,
    });
  }
  const { error } = await supabase.from('sources').upsert([...rows.values()], {
    onConflict: 'owner_id,provider,source_url', ignoreDuplicates: true,
  });
  redirect(error ? '/sources?status=failed' : '/sources?status=imported');
}

export async function saveSource(form: FormData) {
  const { user, supabase } = await requireUser();
  const name = String(form.get('name') ?? '').trim();
  const id = String(form.get('id') ?? '');
  const source = facebookSource(String(form.get('url') ?? ''), form.get('kind'));
  if (!name || name.length > 200 || !source) redirect('/sources?status=invalid');

  const values = { display_name: name, source_url: source.url, kind: source.kind };
  const result = id
    ? await supabase.from('sources').update(values).eq('owner_id', user.id).eq('provider', 'facebook').eq('id', id).select('id').maybeSingle()
    : await supabase.from('sources').insert({ ...values, owner_id: user.id, provider: 'facebook' }).select('id').single();
  if (result.error?.code === '23505') redirect('/sources?status=duplicate');
  redirect(result.error || !result.data ? '/sources?status=failed' : '/sources?status=saved');
}

export async function deleteSource(form: FormData) {
  const { user, supabase } = await requireUser();
  const result = await supabase.from('sources').delete()
    .eq('owner_id', user.id).eq('provider', 'facebook').eq('id', String(form.get('id') ?? ''))
    .select('id').maybeSingle();
  redirect(result.error || !result.data ? '/sources?status=failed' : '/sources?status=deleted');
}
