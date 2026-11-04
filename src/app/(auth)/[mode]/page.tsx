import { notFound } from 'next/navigation';
import { AuthForm } from '@/components/auth-form';
import { requireUser } from '@/lib/auth';
import type { AuthMode } from '@/lib/auth-policy';

export const dynamic = 'force-dynamic';
export default async function AuthPage({ params, searchParams }: { params: Promise<{ mode: string }>; searchParams: Promise<{ error?: string }> }) {
  const { mode } = await params;
  if (!['login', 'register', 'forgot-password', 'reset-password'].includes(mode)) notFound();
  if (mode === 'reset-password') await requireUser();
  const { error } = await searchParams;
  const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname;
  const localInbox = ['localhost', '127.0.0.1'].includes(supabaseHost)
    ? 'http://127.0.0.1:54324'
    : undefined;
  return <AuthForm mode={mode as AuthMode} localInbox={localInbox} googleEnabled={process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true'} initialError={error ? (error === 'google-disabled' ? 'כניסה עם Google אינה זמינה כרגע.' : 'הקישור אינו תקין או שפג תוקפו. נסו להתחבר או בקשו קישור חדש.') : undefined} />;
}
