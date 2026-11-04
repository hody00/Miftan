import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// Test-only service key is used here, never by application code.
const env = { ...parseEnv(readFileSync('.env.local', 'utf8')), ...process.env };
if (!['localhost', '127.0.0.1'].includes(new URL(env.NEXT_PUBLIC_SUPABASE_URL!).hostname)) throw new Error('Browser tests require a local disposable Supabase instance.');
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function emailLink(email: string, type: 'signup' | 'recovery'): Promise<string> {
  let link = '';
  await expect.poll(async () => {
    const inbox = await (await fetch('http://127.0.0.1:54324/api/v1/messages')).json();
    for (const message of inbox.messages ?? []) {
      if (!message.To?.some((recipient: { Address: string }) => recipient.Address === email)) continue;
      const body = await (await fetch(`http://127.0.0.1:54324/api/v1/message/${message.ID}`)).json();
      const match = String(body.HTML).match(/href="([^"]+)"/);
      const candidate = match?.[1].replaceAll('&amp;', '&');
      if (candidate && new URL(candidate).searchParams.get('type') === type) { link = candidate; return true; }
    }
    return false;
  }, { timeout: 15000, message: 'Expected the real development email with a confirmation link' }).toBe(true);
  return link;
}

test('anonymous protection, RTL, mobile overflow and accessible form labels', async ({ page }, testInfo) => {
  await page.goto('/dashboard'); await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByLabel('כתובת דוא״ל')).toHaveAttribute('dir', 'ltr');
  await page.getByLabel('כתובת דוא״ל').focus(); await page.keyboard.press('Tab');
  await expect(page.getByLabel('סיסמה', { exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('login.png'), fullPage: true });
  await page.goto('/reset-password'); await expect(page).toHaveURL(/\/login$/);
  await page.goto('/auth/callback?code=invalid&next=https://evil.example'); await expect(page).toHaveURL(/\/login\?error=auth$/);
});

test('registration, verification, logout, login and password recovery', async ({ page }, testInfo) => {
  const email = `browser-${randomUUID()}@example.com`;
  const password = 'Miftan-Test-Password-429!';
  let id: string | undefined;
  try {
    await page.goto('/register');
    await page.getByLabel('כתובת דוא״ל').fill(email);
    await page.getByLabel('סיסמה', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'יצירת חשבון' }).click();
    await expect(page.getByRole('status').getByRole('link')).toHaveAttribute('href', 'http://127.0.0.1:54324');
    const users = await admin.auth.admin.listUsers();
    id = users.data.users.find(user => user.email === email)?.id;
    const confirmation = await emailLink(email, 'signup');
    await page.goto('/login');
    await page.getByLabel('כתובת דוא״ל').fill(email); await page.getByLabel('סיסמה', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'כניסה לחשבון' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'לא ניתן להתחבר' })).toBeVisible();
    await page.goto(confirmation);
    await expect(page).toHaveURL(/\/dashboard$/); await expect(page.getByText(email, { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('dashboard.png'), fullPage: true });
    await page.getByRole('button', { name: 'יציאה' }).click(); await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('כתובת דוא״ל').fill(email); await page.getByLabel('סיסמה', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'כניסה לחשבון' }).click(); await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByRole('button', { name: 'יציאה' }).click();
    await page.goto('/forgot-password'); await page.getByLabel('כתובת דוא״ל').fill(email);
    await page.getByRole('button', { name: 'שליחת קישור לאיפוס' }).click();
    await expect(page.getByRole('status').getByRole('link')).toHaveAttribute('href', 'http://127.0.0.1:54324');
    await page.goto(await emailLink(email, 'recovery'));
    await expect(page).toHaveURL(/\/reset-password$/);
    await page.getByLabel('סיסמה חדשה', { exact: true }).fill(`${password}new`); await page.getByRole('button', { name: 'שמירת הסיסמה' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByRole('button', { name: 'יציאה' }).click();
    await page.getByLabel('כתובת דוא״ל').fill(email); await page.getByLabel('סיסמה', { exact: true }).fill(`${password}new`);
    await page.getByRole('button', { name: 'כניסה לחשבון' }).click(); await expect(page).toHaveURL(/\/dashboard$/);
  } finally { if (id) await admin.auth.admin.deleteUser(id); }
});
