import { expect, test, type Page } from '@playwright/test';
import pl from '../messages/pl/results.json' with { type: 'json' };
import en from '../messages/en/results.json' with { type: 'json' };
import pp from '../messages/pl/preview.json' with { type: 'json' };
import pe from '../messages/en/preview.json' with { type: 'json' };
test.describe.configure({ timeout: 90_000 });
class ResultPage {
  constructor(
    readonly page: Page,
    readonly locale: 'pl' | 'en',
  ) {}
  get copy() {
    return this.locale === 'pl' ? pl : en;
  }
  get preview() {
    return this.locale === 'pl' ? pp : pe;
  }
  async open(large = false) {
    await this.page.goto(`/${this.locale}/design-system#ResultLayout`);
    // Przykład katalogu używa publicznego putResult; przejście klienta zachowuje store w pamięci.
    await this.page
      .getByRole('link', {
        name: large ? this.copy.openLarge : this.copy.openExample,
        exact: true,
      })
      .click();
    await expect(this.page).toHaveURL(
      /\/results\/catalogue-(tax|large)\/json$/,
      { timeout: 20_000 },
    );
    await expect(
      this.page.getByRole('button', { name: this.copy.download, exact: true }),
    ).toBeVisible();
  }
  async tab(name: 'json' | 'validation' | 'preview') {
    await this.page
      .getByRole('link', { name: this.copy[name], exact: true })
      .click();
  }
}
for (const width of [390, 820])
  for (const locale of ['pl', 'en'] as const) {
    test(`wynik, walidacja i podgląd ${locale} ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const result = new ResultPage(page, locale);
      await result.open();
      const download = page.waitForEvent('download');
      await page
        .getByRole('button', { name: result.copy.download, exact: true })
        .click();
      expect((await download).suggestedFilename()).toContain(
        'konfiguracja-catalogue-tax',
      );
      await result.tab('validation');
      await page
        .getByRole('button', { name: result.copy.validate, exact: true })
        .click();
      await expect(
        page.getByText(result.copy.noIssues, { exact: true }),
      ).toBeVisible();
      // Deterministyczna odpowiedź /validate z błędami na warstwie transportu mocka.
      await page.evaluate(() => {
        const original = window.fetch;
        window.fetch = async (input, init) =>
          String(input).includes('/forms/validate')
            ? new Response(
                JSON.stringify({
                  valid: false,
                  errors: [
                    {
                      code: 'REQUIRED',
                      path: 'tabs[0]',
                      message: 'Fixture issue',
                      severity: 'error',
                    },
                  ],
                  warnings: [
                    {
                      code: 'FLOW',
                      path: 'flow',
                      message: 'Fixture warning',
                      severity: 'warning',
                    },
                  ],
                  sample_errors: [
                    { techName: 'pesel', value: '123', failed: ['PESEL'] },
                  ],
                  sample_unknown: ['unknown'],
                }),
                {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                },
              )
            : original(input, init);
      });
      await page
        .getByLabel(result.copy.samples, { exact: true })
        .fill('{"pesel":"123","unknown":"x"}');
      await page
        .getByRole('button', { name: result.copy.validate, exact: true })
        .click();
      await expect(
        page.getByRole('cell', { name: 'REQUIRED', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(result.copy.sampleErrors, { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(result.copy.sampleUnknown, { exact: true }),
      ).toBeVisible();
      await page.getByLabel(result.copy.filter, { exact: true }).fill('FLOW');
      await expect(
        page.getByRole('cell', { name: 'REQUIRED', exact: true }),
      ).toHaveCount(0);
      await result.tab('preview');
      await page
        .getByRole('radio', { name: 'Innej osoby', exact: true })
        .check();
      await expect(
        page.getByRole('heading', { name: 'Dane innej osoby', exact: true }),
      ).toBeVisible();
      await page
        .getByRole('radio', {
          name: 'Osoby prawnej lub jednostki organizacyjnej',
          exact: true,
        })
        .check();
      await expect(
        page.getByRole('heading', { name: 'Dane podmiotu', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Dane innej osoby', exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole('radio', { name: 'Pełnomocnik', exact: true })
        .check();
      await expect(
        page.getByRole('heading', {
          name: 'Opłata skarbowa za pełnomonictwo',
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByRole('button', { name: result.preview.next, exact: true })
        .click();
      await page
        .getByRole('radio', {
          name: 'Zwrócić przelewem na rachunek bankowy',
          exact: true,
        })
        .check();
      await expect(
        page.getByRole('textbox', { name: 'Numer rachunku', exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(errors).toEqual([]);
    });
    test(`duży JSON ${locale} ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page
        .context()
        .grantPermissions(['clipboard-read', 'clipboard-write']);
      const result = new ResultPage(page, locale);
      await result.open(true);
      const region = page.getByRole('region', { name: 'JSON', exact: true });
      await region
        .getByRole('button', {
          name: `${result.copy.expand} largeExample`,
          exact: true,
        })
        .click();
      await region
        .getByRole('button', { name: result.copy.more, exact: true })
        .click();
      expect(await region.locator('button').count()).toBeLessThan(150);
      expect(
        await region.evaluate((el) => el.scrollHeight > el.clientHeight),
      ).toBe(true);
      await page
        .getByRole('button', { name: result.copy.copy, exact: true })
        .click();
      await expect(
        page.getByRole('status').filter({ hasText: result.copy.copied }),
      ).toBeVisible();
    });
  }
test('brak wyniku', async ({ page }) => {
  await page.goto('/pl/results/missing/preview');
  await expect(page.getByText(pl.notFound, { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: pl.upload })).toHaveAttribute(
    'href',
    '/pl/upload',
  );
});
