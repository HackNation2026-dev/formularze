import { expect, test } from '@playwright/test';

test('mock w przeglądarce obsługuje kontrakt analizy i nagłówki', async ({
  page,
}) => {
  await page.goto('/pl/upload');
  await expect(
    page.getByRole('heading', { name: 'Wczytaj formularze' }),
  ).toBeVisible();
  const result = await page.evaluate(async () => {
    const formats = await fetch('/api/v1/formats').then((response) =>
      response.json(),
    );
    const body = new FormData();
    body.append(
      'file',
      new File(['%PDF-1.7'], 'degraded.pdf', { type: 'application/pdf' }),
    );
    const response = await fetch('/api/v1/forms/analyze', {
      method: 'POST',
      body,
    });
    return {
      formats,
      status: response.status,
      extractor: response.headers.get('X-Extractor'),
      form: await response.json(),
    };
  });
  expect(result.formats.extensions).toContain('pdf');
  expect(result.status).toBe(200);
  expect(result.extractor).toBe('HeuristicExtractor');
  expect(result.form.title).toContain('nieruchomości');
});
