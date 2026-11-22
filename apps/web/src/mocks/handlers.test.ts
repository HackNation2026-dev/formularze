// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ApiClient } from '@/lib/api/client';
import { errorStatuses, type KnownErrorCode } from '@/lib/api/errors';
import {
  getMockScenario,
  scenarios,
  setMockScenario,
  scenarioForFilename,
  type MockScenario,
} from './scenarios';

const client = new ApiClient('http://localhost');
const file = (name = 'formularz.pdf', content = '%PDF-1.7') =>
  new File([content], name, { type: 'application/pdf' });
describe('scenariusze mocka', () => {
  it.each(Object.keys(errorStatuses) as KnownErrorCode[])(
    'ustawienie %s',
    async (code) => {
      setMockScenario(code);
      expect(getMockScenario()).toBe(code);
      await expect(client.analyze(file())).rejects.toMatchObject({
        code,
        status: errorStatuses[code],
      });
    },
  );
  it.each<[string, MockScenario]>([
    ['413.pdf', 'FILE_TOO_LARGE'],
    ['415.pdf', 'UNSUPPORTED_MEDIA_TYPE'],
    ['mime.pdf', 'MIME_MISMATCH'],
    ['401.pdf', 'UNAUTHORIZED'],
    ['timeout.pdf', 'PROCESSING_TIMEOUT'],
    ['503.pdf', 'MODEL_UNAVAILABLE'],
    ['invalid-output.pdf', 'INVALID_OUTPUT'],
    ['auth-misconfigured.pdf', 'AUTH_MISCONFIGURED'],
    ['missing-file.pdf', 'MISSING_FILE'],
    ['too-many-files.pdf', 'TOO_MANY_FILES'],
    ['invalid-form-definition.pdf', 'INVALID_FORM_DEFINITION'],
    ['invalid-sample-values.pdf', 'INVALID_SAMPLE_VALUES'],
    ['a'.repeat(251) + '.pdf', 'INVALID_FILENAME'],
    ['bad;.pdf', 'INVALID_FILENAME'],
  ])('nazwa %s wybiera %s', async (name, code) => {
    expect(scenarioForFilename(name)).toBe(code);
    await expect(client.analyze(file(name))).rejects.toMatchObject({ code });
  });
  it.each(['detail', 'plain-500'] as const)(
    'ustawienie %s obsługuje brak koperty',
    async (scenario) => {
      setMockScenario(scenario);
      await expect(client.analyze(file())).rejects.toMatchObject({
        code: 'HTTP_ERROR',
        hasEnvelope: false,
        status: scenario === 'detail' ? 422 : 500,
      });
    },
  );
  it.each(['degraded', 'degraded.pdf'])(
    'wynik zdegradowany %s',
    async (scenario) => {
      if (scenario === 'degraded') setMockScenario(scenario);
      expect(
        (
          await client.analyze(
            file(scenario === 'degraded' ? 'form.pdf' : scenario),
          )
        ).metadata.extractor,
      ).toBe('HeuristicExtractor');
    },
  );
  it.each(['success', 'auto'] as const)(
    'sukces %s zwraca prawdziwy fixture',
    async (scenario) => {
      setMockScenario(scenario);
      expect(
        (await client.analyze(file('05_nadplata.pdf'))).form.title,
      ).toContain('nadpłat');
    },
  );
  it('ustawienie ma pierwszeństwo przed nazwą', () => {
    setMockScenario('success');
    expect(scenarioForFilename('413.pdf')).toBe('success');
  });
  it('scenariusze obejmują wszystkie błędy', () => {
    expect(scenarios).toEqual(
      expect.arrayContaining(Object.keys(errorStatuses)),
    );
  });
  it('health, ready, formats', async () => {
    expect((await client.health()).status).toBe('ok');
    expect((await client.ready()).status).toBe('ok');
    expect((await client.formats()).extensions).toContain('pdf');
    setMockScenario('degraded');
    expect((await client.ready()).status).toBe('degraded');
  });
  it('batch zawiera osobno sukces i błąd', async () => {
    const result = await client.analyzeBatch([file(), file('413.pdf')]);
    expect(result.ok).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.results[1]).toMatchObject({
      error: { code: 'FILE_TOO_LARGE' },
    });
  });
  it('pusty batch i przekroczenie limitu', async () => {
    await expect(client.analyzeBatch([])).rejects.toMatchObject({
      code: 'MISSING_FILE',
    });
    await expect(
      client.analyzeBatch(Array.from({ length: 11 }, () => file())),
    ).rejects.toMatchObject({ code: 'TOO_MANY_FILES' });
  });
  it('brak pliku i pusty plik', async () => {
    await expect(client.analyze(file('pusty.pdf', ''))).rejects.toMatchObject({
      code: 'MISSING_FILE',
    });
    const response = await fetch('http://localhost/api/v1/forms/analyze', {
      method: 'POST',
      body: new FormData(),
    });
    expect(response.status).toBe(400);
  });
  it('nieobsługiwane rozszerzenie', async () => {
    await expect(client.analyze(file('test.exe'))).rejects.toMatchObject({
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
  });
  it('walidacja: sukces i błędne ciało', async () => {
    expect(
      (await client.validate({ title: 'Test', tabs: [], flow: { links: [] } }))
        .valid,
    ).toBe(true);
    for (const [body, code] of [
      [{}, 'INVALID_FORM_DEFINITION'],
      [{ title: 'Test', sample_values: 'x' }, 'INVALID_SAMPLE_VALUES'],
    ] as const) {
      const response = await fetch('http://localhost/api/v1/forms/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ error: { code } });
    }
  });
});
