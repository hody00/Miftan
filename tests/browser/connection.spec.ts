import { test, expect } from '@playwright/test';

test('Facebook login comes first and disconnected operations are blocked', async ({ page }) => {
  await page.goto('/admin');
  await page.getByLabel('כתובת אימייל').fill(process.env.ADMIN_EMAIL!);
  await page.getByLabel('סיסמה').fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole('button', {name:'כניסה לניהול'}).click();
  await expect(page.getByRole('heading',{name:'1. התחברות לפייסבוק'})).toBeVisible();
  await expect(page.getByRole('button',{name:'פתיחת חלון התחברות'})).toBeEnabled();
  await expect(page.getByRole('button',{name:'גילוי קבוצות',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'סנכרון כעת',exact:true})).toBeDisabled();
  const origin=new URL(page.url()).origin;
  for (const kind of ['discover','sync']) {
    const response=await page.request.post('/api/admin',{
      headers:{Origin:origin},data:{action:'job',kind},
    });
    expect(response.status()).toBe(409);
  }
  const positions=await page.evaluate(()=>({
    connection:document.querySelector('.crawler-panel')!.getBoundingClientRect().top,
    stats:document.querySelector('.stats')!.getBoundingClientRect().top,
  }));
  expect(positions.connection).toBeLessThan(positions.stats);
});
