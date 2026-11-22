import { expect, test } from '@playwright/test';

test('strona startowa i przełączenie języka', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/pl$/);
  await expect(
    page.getByRole('heading', { name: 'Strona startowa' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'EN', exact: true }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('motyw zapisuje preferencję i pozostaje po odświeżeniu', async ({
  page,
}) => {
  await page.goto('/pl');
  await page.getByRole('combobox').selectOption('Dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'Dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'Dark');
});
