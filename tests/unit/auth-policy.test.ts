import { describe, expect, it } from 'vitest';
import { safeNext, validateCredentials } from '../../src/lib/auth-policy';

describe('safe authentication destinations', () => {
  it.each(['https://evil.example', '//evil.example', '/\\evil.example', '/%2f%2fevil.example', '/reset-password?next=https://evil.example', '', null, undefined])('rejects %s', (value) => {
    expect(safeNext(value)).toBe('/dashboard');
  });
  it('allows the password reset destination', () => expect(safeNext('/reset-password')).toBe('/reset-password'));
});
describe('server credential validation', () => {
  it('rejects invalid email and short passwords', () => {
    expect(validateCredentials('register', 'invalid', 'long-password')).toBeTruthy();
    expect(validateCredentials('register', 'a@example.com', '123')).toBeTruthy();
  });
  it('does not require a password for recovery or an email for reset', () => {
    expect(validateCredentials('forgot-password', 'a@example.com', '')).toBeNull();
    expect(validateCredentials('reset-password', '', 'long-password')).toBeNull();
  });
});
