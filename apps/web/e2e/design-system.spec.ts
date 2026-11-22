import { expect, test, type Page } from '@playwright/test';
import pl from '../messages/pl/design-system.json' with { type: 'json' };
import en from '../messages/en/design-system.json' with { type: 'json' };

class DesignSystemPage {
  constructor(readonly page: Page) {}
  async open(locale: 'pl' | 'en', theme: 'Light' | 'Dark', width: number) {
    await this.page.setViewportSize({ width, height: 900 });
    await this.page.addInitScript(
      (value) => localStorage.setItem('formgen.theme', value),
      theme,
    );
    await this.page.goto(`/${locale}/design-system`);
    const copy = locale === 'pl' ? pl : en;
    await expect(
      this.page.getByRole('heading', { name: copy.title, exact: true }),
    ).toBeVisible();
    await expect(this.page.locator('html')).toHaveAttribute(
      'data-theme',
      theme,
    );
    await expect(this.page.locator('html')).toHaveAttribute('lang', locale);
    return copy;
  }
}

test('katalog PL/EN, oba motywy, telefon i tablet bez błędów konsoli', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const catalogue = new DesignSystemPage(page);
  for (const width of [360, 820]) {
    for (const locale of ['pl', 'en'] as const) {
      for (const theme of ['Light', 'Dark'] as const) {
        const copy = await catalogue.open(locale, theme, width);
        await expect(
          page.getByRole('heading', { name: 'FileRow', exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole('heading', { name: 'ValidationItem', exact: true }),
        ).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        // Każdy aktywny cel interaktywny ma przynajmniej 44 px wysokości.
        const shortTargets = await page
          .locator('main')
          .locator(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), a',
          )
          .evaluateAll((elements) =>
            elements
              .filter((element) => {
                const target = element.matches(
                  'input[type=checkbox], input[type=radio]',
                )
                  ? element.closest('label')!
                  : element;
                const rect = target.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0 && rect.height < 44;
              })
              .map((element) => element.outerHTML),
          );
        expect(shortTargets).toEqual([]);
        await page
          .getByRole('combobox', { name: copy.theme })
          .selectOption(theme === 'Light' ? 'Dark' : 'Light');
        await expect(page.locator('html')).toHaveAttribute(
          'data-theme',
          theme === 'Light' ? 'Dark' : 'Light',
        );
      }
    }
  }
  await page.getByRole('combobox', { name: en.language }).selectOption('pl');
  await expect(page).toHaveURL(/\/pl\/design-system$/);
  await expect(
    page.getByRole('heading', { name: pl.title, exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
