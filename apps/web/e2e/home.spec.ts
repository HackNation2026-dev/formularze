import { expect, test } from '@playwright/test';

test('strona startowa przekierowuje do panelu uploadu i przełącza język', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/upload$/);
  await expect(
    page.getByRole('heading', { name: 'Wczytaj formularze' }),
  ).toBeVisible();
  await page.getByLabel('Język').selectOption('en');
  await expect(page).toHaveURL(/\/en\/upload$/);
  await expect(
    page.getByRole('heading', { name: 'Upload forms' }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('motyw zapisuje preferencję i pozostaje po odświeżeniu', async ({
  page,
}) => {
  await page.goto('/pl/upload');
  await page.getByLabel('Motyw').selectOption('Dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'Dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'Dark');
});
