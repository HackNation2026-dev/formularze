import { http, HttpResponse } from 'msw/http';
import { errorStatuses, type KnownErrorCode } from '@/lib/api/errors';
import { formDefinitionSchema } from '@/lib/api/schemas';
import {
  getMockScenario,
  scenarioForFilename,
  type MockScenario,
} from './scenarios';
import address from './fixtures/01_numer_porzadkowy_nieruchomosci.json';
import tax from './fixtures/05_nadplata_podatku.json';

export const extensions = [
  'doc',
  'docx',
  'jpeg',
  'jpg',
  'ods',
  'pdf',
  'png',
  'xlsx',
];
const meta = {
  processing_time_ms: 125,
  detected_type: 'pdf',
  detected_score: 1,
  warnings: 0,
  extractor: 'MockExtractor',
};
function error(code: KnownErrorCode) {
  return { code, message: `Mock: ${code}`, details: {} };
}
function failure(scenario: MockScenario) {
  if (scenario === 'detail')
    return HttpResponse.json(
      { detail: [{ msg: 'Nieprawidłowe ciało żądania' }] },
      { status: 422 },
    );
  if (scenario === 'plain-500')
    return HttpResponse.text('Internal Server Error', { status: 500 });
  if (scenario in errorStatuses) {
    const code = scenario as KnownErrorCode;
    return HttpResponse.json(
      { error: error(code) },
      { status: errorStatuses[code] },
    );
  }
  return null;
}
type FileResult =
  | { code: KnownErrorCode }
  | { scenario: MockScenario }
  | { form: typeof address | typeof tax; metadata: typeof meta };
function analyzeFile(file: FormDataEntryValue | null): FileResult {
  if (!file || typeof file === 'string' || !file.name.trim() || file.size === 0)
    return { code: 'MISSING_FILE' as const };
  const scenario = scenarioForFilename(file.name);
  if (scenario !== 'success' && scenario !== 'degraded') return { scenario };
  if (file.size > 25 * 1024 * 1024) return { code: 'FILE_TOO_LARGE' as const };
  if (!extensions.includes(file.name.split('.').pop()?.toLowerCase() ?? ''))
    return { code: 'UNSUPPORTED_MEDIA_TYPE' as const };
  const form =
    file.name.includes('05') || file.name.includes('nadplata') ? tax : address;
  return {
    form,
    metadata: {
      ...meta,
      extractor:
        scenario === 'degraded' ? 'HeuristicExtractor' : meta.extractor,
    },
  };
}
export const handlers = [
  http.get('*/health', () =>
    HttpResponse.json({ status: 'ok', version: '0.1.0' }),
  ),
  http.get('*/ready', () => {
    const scenario = getMockScenario();
    const status =
      scenario === 'MODEL_UNAVAILABLE'
        ? 'unavailable'
        : scenario === 'degraded'
          ? 'degraded'
          : 'ok';
    return HttpResponse.json(
      {
        status,
        extractor: 'llm',
        llm: 'http://localhost:11434',
        ocr: 'tesseract',
        llm_alive: status === 'ok',
      },
      { status: status === 'unavailable' ? 503 : 200 },
    );
  }),
  http.get('*/api/v1/formats', () =>
    HttpResponse.json({ extensions, max_upload_size_mb: 25 }),
  ),
  http.post('*/api/v1/forms/analyze', async ({ request }) => {
    const formData = await request.formData();
    const result = analyzeFile(formData.get('file'));
    if ('code' in result) return failure(result.code)!;
    if ('scenario' in result) return failure(result.scenario)!;
    return HttpResponse.json(result.form, {
      headers: {
        'X-Processing-Time-Ms': String(result.metadata.processing_time_ms),
        'X-Detected-Type': `${result.metadata.detected_type};score=1.000`,
        'X-Warnings': String(result.metadata.warnings),
        'X-Extractor': result.metadata.extractor,
      },
    });
  }),
  http.post('*/api/v1/forms/analyze-batch', async ({ request }) => {
    const forced = getMockScenario();
    if (forced === 'UNAUTHORIZED' || forced === 'AUTH_MISCONFIGURED')
      return failure(forced)!;
    const files = (await request.formData()).getAll('files');
    if (!files.length) return failure('MISSING_FILE')!;
    if (files.length > 10 || forced === 'TOO_MANY_FILES')
      return failure('TOO_MANY_FILES')!;
    const results = files.map((file) => {
      const filename = typeof file === 'string' ? file : file.name;
      const result = analyzeFile(file);
      if ('form' in result)
        return { filename, status: 200, form: result.form, ...result.metadata };
      const code =
        'code' in result
          ? result.code
          : result.scenario in errorStatuses
            ? (result.scenario as KnownErrorCode)
            : 'INVALID_OUTPUT';
      return { filename, status: errorStatuses[code], error: error(code) };
    });
    const ok = results.filter((result) => result.status === 200).length;
    return HttpResponse.json({ results, ok, failed: results.length - ok });
  }),
  http.post('*/api/v1/forms/validate', async ({ request }) => {
    const forced = failure(getMockScenario());
    if (forced) return forced;
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return HttpResponse.json({ detail: [] }, { status: 422 });
    const values = 'sample_values' in body ? body.sample_values : {};
    if (values && (typeof values !== 'object' || Array.isArray(values)))
      return failure('INVALID_SAMPLE_VALUES')!;
    const parsed = formDefinitionSchema.safeParse(body);
    if (!parsed.success) return failure('INVALID_FORM_DEFINITION')!;
    return HttpResponse.json({
      valid: true,
      errors: [],
      warnings: [],
      sample_errors: [],
      sample_unknown: [],
    });
  }),
];
