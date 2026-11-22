import { test, expect } from '@playwright/test';
import plAuth from '../messages/pl/auth.json' with { type: 'json' };
import enAuth from '../messages/en/auth.json' with { type: 'json' };
import plUpload from '../messages/pl/upload.json' with { type: 'json' };
import enUpload from '../messages/en/upload.json' with { type: 'json' };
import plShell from '../messages/pl/shell.json' with { type: 'json' };
import enShell from '../messages/en/shell.json' with { type: 'json' };
test.describe.configure({ timeout: 60_000 });
for (const locale of ['pl', 'en'] as const) {
  for (const width of [390, 820]) {
    test(`logowanie, kolejka, 413/415/401, retry i wynik: ${locale}, ${width}`, async ({
      page,
    }, testInfo) => {
      const auth = locale === 'pl' ? plAuth : enAuth;
      const upload = locale === 'pl' ? plUpload : enUpload;
      const shell = locale === 'pl' ? plShell : enShell;
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${locale}/login`);
      await page.getByLabel(auth.token).fill('test.jwt.token');
      await page.getByRole('button', { name: auth.login, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/upload$`), {
        timeout: 15000,
      });
      await expect(page.getByText(upload.empty, { exact: true })).toBeVisible();
      const nav = page
        .getByRole('navigation', { name: shell.navigation })
        .filter({ visible: true });
      await expect(nav).toHaveCount(1);
      await page.getByLabel(upload.choose, { exact: true }).setInputFiles(
        ['413.pdf', '415.pdf', '401.pdf', 'good.pdf'].map((name) => ({
          name,
          mimeType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.7'),
        })),
      );
      await page
        .getByRole('button', { name: upload.analyze, exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/login\\?reason=401`));
      await expect(page.getByRole('main').getByRole('alert')).toHaveText(
        auth.unauthorized,
      );
      await page.getByLabel(auth.token).fill('new.jwt.token');
      await page.getByRole('button', { name: auth.login, exact: true }).click();
      const queue = page.getByRole('region', { name: upload.queue });
      await expect(queue.getByText(/FILE_TOO_LARGE/)).toBeVisible();
      await expect(queue.getByText(/UNSUPPORTED_MEDIA_TYPE/)).toBeVisible();
      await expect(queue.getByText(/UNAUTHORIZED/)).toBeVisible();
      await page.evaluate(() =>
        localStorage.setItem('formgen.mockScenario', 'success'),
      );
      await queue
        .getByRole('button', { name: upload.retry, exact: true })
        .click();
      await expect(queue.getByText(upload.done, { exact: true })).toHaveCount(
        2,
      );
      await queue
        .getByRole('button', { name: upload.details, exact: true })
        .last()
        .click();
      const detail =
        width < 768
          ? page.getByRole('dialog')
          : page.getByRole('complementary', { name: upload.details });
      await expect(detail).toBeVisible();
      await expect(
        detail.getByText('MockExtractor', { exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath('upload-details.png'),
        fullPage: true,
      });
      await detail
        .getByRole('button', { name: shell.close, exact: true })
        .click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await queue
        .getByRole('button', { name: upload.result, exact: true })
        .last()
        .click();
      await expect(page).toHaveURL(
        new RegExp(`/${locale}/results/[^/]+/json$`),
        { timeout: 15000 },
      );
      expect(errors).toEqual([]);
    });
  }
}
test('bez tokenu, walidacja klienta, timeout, 503, heurystyka i ustawienia', async ({
  page,
}) => {
  await page.goto('/pl/login');
  await page.getByRole('button', { name: plAuth.skip }).click();
  await page.getByLabel(plUpload.choose, { exact: true }).setInputFiles([
    {
      name: 'bad;name.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('data'),
    },
    {
      name: 'bad.exe',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('data'),
    },
    ...['timeout.pdf', '503.pdf', 'degraded.pdf'].map((name) => ({
      name,
      mimeType: 'application/pdf',
      buffer: Buffer.from('data'),
    })),
  ]);
  await expect(page.getByText(/INVALID_FILENAME/)).toBeVisible();
  await expect(page.getByText(/UNSUPPORTED_MEDIA_TYPE/)).toBeVisible();
  await page.getByRole('button', { name: plUpload.analyze }).click();
  await expect(page.getByText(/PROCESSING_TIMEOUT/)).toBeVisible();
  await expect(page.getByText(/MODEL_UNAVAILABLE/)).toBeVisible();
  await expect(page.getByText(plUpload.degraded)).toBeVisible();
  await page
    .getByRole('navigation')
    .filter({ visible: true })
    .getByRole('link', { name: plShell.settings })
    .click();
  await page
    .getByRole('combobox', { name: plShell.theme })
    .first()
    .selectOption('Dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'Dark');
  await page
    .getByRole('combobox', { name: 'Scenariusz API' })
    .selectOption('success');
  await page
    .getByRole('navigation')
    .filter({ visible: true })
    .getByRole('link', { name: plShell.upload })
    .click();
  await page
    .getByRole('button', { name: plUpload.retry, exact: true })
    .first()
    .click();
  await expect(page.getByText(plUpload.done, { exact: true })).toHaveCount(2);
  await page
    .getByRole('combobox', { name: plShell.language })
    .selectOption('en');
  await expect(page).toHaveURL('/en/upload');
  await expect(page.getByText(enUpload.done, { exact: true })).toHaveCount(2);
});
test('otwiera JSON z dysku jako local-* bez wywołania analizy', async ({
  page,
}) => {
  await page.goto('/pl/open');
  await page.getByLabel('Wybierz plik JSON', { exact: true }).setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{}'),
  });
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  await page.getByLabel('Wybierz plik JSON', { exact: true }).setInputFiles({
    name: 'local.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"title":"Local","tabs":[]}'),
  });
  await expect(page).toHaveURL(/\/pl\/results\/local-[^/]+\/json$/, {
    timeout: 15000,
  });
});

test('ustawienia maskują token i pozwalają go usunąć', async ({ page }) => {
  await page.goto('/pl/login');
  await page.getByLabel(plAuth.token).fill('test.jwt.secret');
  await page.getByRole('button', { name: plAuth.login, exact: true }).click();
  await expect(page).toHaveURL('/pl/upload', { timeout: 15000 });
  await page
    .getByRole('navigation')
    .filter({ visible: true })
    .getByRole('link', { name: plShell.settings })
    .click();
  const token = page.getByLabel('Zapisany token JWT');
  await expect(token).toHaveAttribute('type', 'password');
  await expect(token).toHaveValue('test.jwt.secret');
  await page.getByRole('button', { name: 'Usuń token', exact: true }).click();
  await expect(page.getByText('Brak zapisanego tokenu')).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem('formgen.token')),
  ).toBeNull();
});
