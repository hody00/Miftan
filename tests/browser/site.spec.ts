import { test, expect } from "@playwright/test";
test('listing details and saved favorites persist',async({page})=>{
 await page.goto('/?city='+encodeURIComponent('חיפה'));
 const card=page.locator('.card').first();await expect(card).toBeVisible();
 await card.getByRole('button',{name:'שמירת הבית'}).click();
 await page.goto('/favorites');await expect(page.locator('.card')).toHaveCount(1);
 await page.locator('.card h3 a').click();await expect(page.getByRole('heading',{name:'קצת על הבית'})).toBeVisible();
 await expect(page.getByRole('link',{name:'למודעה המקורית'})).toHaveAttribute('href',/facebook.com/);
 await page.getByRole('button',{name:'הסרה מהשמורים'}).click();await page.goto('/favorites');await expect(page.getByRole('heading',{name:'מקום לבתים שאהבתם'})).toBeVisible();
});
test('admin login, corrections, source controls and logout',async({page})=>{
 await page.goto('/admin');await page.getByLabel('כתובת אימייל').fill(process.env.ADMIN_EMAIL!);await page.getByLabel('סיסמה').fill(process.env.ADMIN_PASSWORD!);await page.getByRole('button',{name:'כניסה לניהול'}).click();
 await expect(page.getByRole('heading',{name:'ניהול הבית'})).toBeVisible();
 await page.getByRole('tab',{name:'מודעות',exact:true}).click();await page.getByRole('button',{name:'עריכה ופרסום'}).first().click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await dialog.getByLabel('מחיר', {exact:true}).fill('4400');await dialog.getByRole('button',{name:'שמירת השינויים'}).click();await expect(dialog).not.toBeVisible();
 await page.getByRole('tab',{name:'מקורות',exact:true}).click();await expect(page.getByText('מקור בדיקה',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'התנתקות'}).click();await expect(page.getByLabel('סיסמה')).toBeVisible();
});
test("Hebrew search is accessible, responsive and shareable", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "המקום הבא",
  );
  await page.getByPlaceholder("עיר, למשל תל אביב").fill("חיפה");
  await page.getByRole("button", { name: "למצוא את הבית שלי" }).click();
  await expect(page).toHaveURL(/city=/);
  await expect(page.getByPlaceholder("עיר, למשל תל אביב")).toHaveValue("חיפה");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("favorites starts with an honest empty state", async ({ page }) => {
  await page.goto("/favorites");
  await expect(
    page.getByRole("heading", { name: "מקום לבתים שאהבתם" }),
  ).toBeVisible();
});
test("admin data requires login and mutation rejects missing origin", async ({
  request,
  page,
}) => {
  expect((await request.get("/api/admin")).status()).toBe(401);
  expect(
    (
      await request.post("/api/admin", {
        data: { action: "job", kind: "sync" },
      })
    ).status(),
  ).toBe(403);
  await page.goto("/admin");
  await expect(page.getByLabel("סיסמה")).toBeVisible();
});
test("unknown listing is a real not-found page", async ({ page }) => {
  await page.goto("/listing/00000000-0000-0000-0000-000000000001");
  await expect(
    page.getByRole("heading", { name: "הדלת הזו כבר נסגרה" }),
  ).toBeVisible();
});
