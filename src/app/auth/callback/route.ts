import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { appOrigin } from '@/lib/auth';
import { safeNext } from '@/lib/auth-policy';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext(request.nextUrl.searchParams.get('next')), appOrigin()));
  }
  return NextResponse.redirect(new URL('/login?error=auth', appOrigin()));
}
