import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';

export async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');
  return { user, supabase };
}

export function appOrigin(): string {
  // Never derive security-sensitive redirect origins from the Host header.
  return new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').origin;
}
