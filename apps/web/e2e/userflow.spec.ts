import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import plAuth from '../messages/pl/auth.json' with { type: 'json' };
import enAuth from '../messages/en/auth.json' with { type: 'json' };
import plUpload from '../messages/pl/upload.json' with { type: 'json' };
import enUpload from '../messages/en/upload.json' with { type: 'json' };
import plShell from '../messages/pl/shell.json' with { type: 'json' };
import enShell from '../messages/en/shell.json' with { type: 'json' };
import pl from '../messages/pl/results.json' with { type: 'json' };
import en from '../messages/en/results.json' with { type: 'json' };
const fixture = readFileSync('src/mocks/fixtures/05_nadplata_podatku.json');
test.describe.configure({ timeout: 90_000 });
for (const locale of ['pl', 'en'] as const)
  for (const width of [390, 820]) {
    test(`pełny przepływ ${locale} ${width}`, async ({
      page,
      context,
    }, testInfo) => {
      const auth = locale === 'pl' ? plAuth : enAuth;
      const upload = locale === 'pl' ? plUpload : enUpload;
      const shell = locale === 'pl' ? plShell : enShell;
      const result = locale === 'pl' ? pl : en;
      const errors: string[] = [];
      const external: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      context.on('request', (request) => {
        const url = new URL(request.url());
        if (
          ['http:', 'https:'].includes(url.protocol) &&
          !['localhost', '127.0.0.1'].includes(url.hostname)
        )
          external.push(request.url());
      });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${locale}/login`);
      await page.getByRole('button', { name: auth.skip, exact: true }).click();
      await page.getByLabel(upload.choose, { exact: true }).setInputFiles({
        name: '05_nadplata.pdf',
        mimeType: 'application/pdf',
        buffer: fixture,
      });
      await expect(
        page.getByText(upload.queued, { exact: true }),
      ).toBeVisible();
      await page
        .getByRole('button', { name: upload.analyze, exact: true })
        .click();
      await expect(page).toHaveURL(
        new RegExp(`/${locale}/results/[^/]+/json$`),
      );
      const apiResultUrl = page.url();
      const nav = () =>
        page
          .getByRole('navigation', { name: shell.navigation })
          .filter({ visible: true });
      await expect(
        nav().getByRole('link', { name: shell.result, exact: true }),
      ).toHaveAttribute('aria-current', 'page');
      await page
        .getByRole('link', { name: result.validation, exact: true })
        .click();
      await page.evaluate(() => {
        const original = window.fetch;
        window.fetch = async (input, init) =>
          String(input).includes('/forms/validate')
            ? Response.json({
                valid: false,
                errors: [
                  {
                    code: 'REQUIRED',
                    path: 'tabs[0]',
                    message: 'Fixture issue',
                    severity: 'error',
                  },
                ],
                warnings: [],
                sample_errors: [],
                sample_unknown: [],
              })
            : original(input, init);
      });
      await page
        .getByRole('button', { name: result.validate, exact: true })
        .click();
      await expect(
        page.getByRole('cell', { name: 'REQUIRED', exact: true }),
      ).toBeVisible();
      await page
        .getByRole('link', { name: result.preview, exact: true })
        .click();
      await page
        .getByRole('radio', { name: 'Innej osoby', exact: true })
        .check();
      await expect(
        page.getByRole('heading', { name: 'Dane innej osoby', exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath('preview-light.png'),
        fullPage: true,
      });
      await nav()
        .getByRole('link', { name: shell.upload, exact: true })
        .click();
      const queue = page.getByRole('region', { name: upload.queue });
      await expect(queue.getByText(upload.done, { exact: true })).toBeVisible();
      await queue
        .getByRole('button', { name: upload.details, exact: true })
        .click();
      const details =
        width < 768
          ? page.getByRole('dialog')
          : page.getByRole('complementary', { name: upload.details });
      await expect(
        details.getByRole('button', { name: result.preview, exact: true }),
      ).toBeVisible();
      const detailDownload = page.waitForEvent('download');
      await details
        .getByRole('button', { name: result.download, exact: true })
        .click();
      expect((await detailDownload).suggestedFilename()).toMatch(
        /konfiguracja-.*json/,
      );
      await details
        .getByRole('button', { name: shell.close, exact: true })
        .click();
      const download = page.waitForEvent('download');
      await queue
        .getByRole('button', { name: result.download, exact: true })
        .click();
      expect((await download).suggestedFilename()).toMatch(
        /konfiguracja-.*json/,
      );
      await queue
        .getByRole('button', { name: result.preview, exact: true })
        .click();
      await expect(page).toHaveURL(apiResultUrl.replace('/json', '/preview'));
      await nav().getByRole('link', { name: shell.open, exact: true }).click();
      await page.locator('input[type=file]').setInputFiles({
        name: 'local.json',
        mimeType: 'application/json',
        buffer: Buffer.from(
          JSON.stringify({
            ...JSON.parse(fixture.toString()),
            longText: 'Długi tekst '.repeat(1000),
          }),
        ),
      });
      await expect(page).toHaveURL(/\/results\/local-[^/]+\/json$/);
      const localPath = new URL(page.url()).pathname.replace(`/${locale}`, '');
      await expect(
        page.getByRole('region', { name: 'JSON', exact: true }),
      ).toBeVisible();
      const jsonBlock = page.getByRole('region', { name: 'JSON', exact: true });
      expect(
        await jsonBlock.evaluate((el) => el.scrollWidth > el.clientWidth),
      ).toBe(true);
      await nav()
        .getByRole('link', { name: shell.settings, exact: true })
        .click();
      await expect(page).toHaveURL(`/${locale}/settings`);
      await page
        .getByRole('combobox', { name: shell.theme })
        .first()
        .selectOption('Dark');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'Dark');
      const other = locale === 'pl' ? 'en' : 'pl';
      const otherShell = locale === 'pl' ? enShell : plShell;
      await page
        .getByRole('combobox', { name: shell.language })
        .first()
        .selectOption(other);
      await expect(page).toHaveURL(`/${other}/settings`);
      await page
        .getByRole('navigation', { name: otherShell.navigation })
        .filter({ visible: true })
        .getByRole('link', { name: otherShell.result, exact: true })
        .click();
      await expect(page).toHaveURL(`/${other}${localPath}`);
      await page.screenshot({
        path: testInfo.outputPath('result-dark.png'),
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(errors).toEqual([]);
      expect(external).toEqual([]);
    });
  }

for (const locale of ['pl', 'en'] as const)
  for (const width of [390, 820]) {
    test(`błędy i zachowanie pamięci ${locale} ${width}`, async ({
      page,
      context,
    }) => {
      const auth = locale === 'pl' ? plAuth : enAuth;
      const upload = locale === 'pl' ? plUpload : enUpload;
      const shell = locale === 'pl' ? plShell : enShell;
      const result = locale === 'pl' ? pl : en;
      const errors: string[] = [];
      const external: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      context.on('request', (request) => {
        const url = new URL(request.url());
        if (
          ['http:', 'https:'].includes(url.protocol) &&
          !['localhost', '127.0.0.1'].includes(url.hostname)
        )
          external.push(request.url());
      });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${locale}/login`);
      // Wynik bez poprzedniej konfiguracji prowadzi do uploadu.
      await page
        .getByRole('navigation', { name: shell.navigation })
        .filter({ visible: true })
        .getByRole('link', { name: shell.result, exact: true })
        .click();
      await expect(page).toHaveURL(`/${locale}/upload`);
      await page
        .getByLabel(upload.choose, { exact: true })
        .setInputFiles(
          ['413.pdf', '415.pdf', 'timeout.pdf', '401.pdf', '05.pdf'].map(
            (name) => ({ name, mimeType: 'application/pdf', buffer: fixture }),
          ),
        );
      await page
        .getByRole('button', { name: upload.analyze, exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/login\\?reason=401`));
      await page.evaluate(() =>
        localStorage.setItem('formgen.mockScenario', 'success'),
      );
      await page.getByRole('button', { name: auth.skip, exact: true }).click();
      const queue = page.getByRole('region', { name: upload.queue });
      for (const code of [
        'FILE_TOO_LARGE',
        'UNSUPPORTED_MEDIA_TYPE',
        'PROCESSING_TIMEOUT',
        'UNAUTHORIZED',
      ])
        await expect(queue.getByText(new RegExp(code))).toBeVisible();
      await queue
        .getByRole('button', { name: upload.retry, exact: true })
        .first()
        .click();
      await expect(queue.getByText(upload.done, { exact: true })).toHaveCount(
        2,
      );
      await queue
        .getByRole('button', { name: upload.retry, exact: true })
        .click();
      await expect(queue.getByText(upload.done, { exact: true })).toHaveCount(
        3,
      );
      await queue
        .getByRole('button', { name: upload.result, exact: true })
        .last()
        .click();
      await page
        .getByRole('link', { name: result.validation, exact: true })
        .click();
      await expect(page).toHaveURL(/\/validation$/);
      const validationUrl = page.url();
      await page.evaluate(() =>
        localStorage.setItem('formgen.mockScenario', 'UNAUTHORIZED'),
      );
      await page
        .getByRole('button', { name: result.validate, exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/login\\?reason=401`));
      await page.evaluate(() =>
        localStorage.setItem('formgen.mockScenario', 'success'),
      );
      await page.getByRole('button', { name: auth.skip, exact: true }).click();
      await expect(page).toHaveURL(validationUrl);
      await page
        .getByRole('button', { name: result.validate, exact: true })
        .click();
      await expect(
        page.getByText(result.noIssues, { exact: true }),
      ).toBeVisible();
      // Chromium raportuje oczekiwane odpowiedzi błędów również jako diagnostyki zasobów.
      const expectedHttpErrors = [413, 415, 504, 401, 401].map(
        (status) =>
          `Failed to load resource: the server responded with a status of ${status}`,
      );
      expect(errors).toHaveLength(expectedHttpErrors.length);
      errors.forEach((message, index) =>
        expect(message).toContain(expectedHttpErrors[index]),
      );
      expect(external).toEqual([]);
    });
  }
