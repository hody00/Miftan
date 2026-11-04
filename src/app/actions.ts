'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { appOrigin, requireUser } from '@/lib/auth';
import { validateCredentials, type AuthMode, type AuthState } from '@/lib/auth-policy';

export async function submitAuth(mode: AuthMode, _previous: AuthState, form: FormData): Promise<AuthState> {
  if (!['login', 'register', 'forgot-password', 'reset-password'].includes(mode)) return { error: 'בקשה לא תקינה.' };
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const validation = validateCredentials(mode, email, password);
  if (validation) return { error: validation };
  const supabase = await createClient();

  if (mode === 'login') {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: 'לא ניתן להתחבר. בדקו את הפרטים ואמתו את כתובת הדוא״ל.' };
    redirect('/dashboard');
  }
  if (mode === 'register') {
    const { error } = await supabase.auth.signUp({ email, password,
      options: { emailRedirectTo: `${appOrigin()}/auth/callback` },
    });
    if (error) return { error: 'לא ניתן להשלים את ההרשמה כרגע. נסו שוב מאוחר יותר.' };
    return { message: 'בדקו את תיבת הדוא״ל ולחצו על קישור האימות כדי להמשיך.' };
  }
  if (mode === 'forgot-password') {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appOrigin()}/auth/callback?next=/reset-password`,
    });
    if (error) return { error: 'לא ניתן לשלוח קישור כרגע. נסו שוב מאוחר יותר.' };
    return { message: 'אם קיים חשבון מתאים, יישלח אליו קישור לאיפוס הסיסמה.' };
  }
  await requireUser();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: 'לא ניתן לעדכן את הסיסמה. נסו סיסמה אחרת או בקשו קישור חדש.' };
  redirect('/dashboard');
}

export async function signInWithGoogle(): Promise<void> {
  if (process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED !== 'true') redirect('/login?error=google-disabled');
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google', options: { redirectTo: `${appOrigin()}/auth/callback` },
  });
  if (error || !data.url) redirect('/login?error=auth');
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) redirect('/dashboard?error=logout');
  redirect('/login');
}
