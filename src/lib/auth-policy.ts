// Deliberately allow only known destinations, never user-supplied absolute URLs.
export function safeNext(value: string | null | undefined): string {
  return value === '/reset-password' ? value : '/dashboard';
}

export type AuthMode = 'login' | 'register' | 'forgot-password' | 'reset-password';
export type AuthState = { error?: string; message?: string };

export function validateCredentials(mode: AuthMode, email: string, password: string): string | null {
  if (mode !== 'reset-password' && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return 'יש להזין כתובת דוא״ל תקינה.';
  }
  if (mode !== 'forgot-password' && (password.length < 8 || password.length > 128)) {
    return 'הסיסמה צריכה להכיל בין 8 ל־128 תווים.';
  }
  return null;
}
