import { getResult } from '@/features/results';
import { describe, expect, it, vi } from 'vitest';
import { createBatchStore } from './store';

const form = () => ({ title: 'Form', tabs: [], flow: { links: [] } });
const file = (name: string) => new File(['%PDF-1.7'], name, { type: 'application/pdf' });
const ok = (filename: string) => ({
  filename,
  status: 200 as const,
  form: form(),
  processing_time_ms: 10,
  detected_type: 'pdf',
  detected_score: 1,
  warnings: 0,
  extractor: 'StubExtractor',
});
const fail = (filename: string | null, code = 'UNSUPPORTED_MEDIA_TYPE', status = 415) => ({
  filename,
  status,
  error: { code, message: 'Nieobsługiwany format pliku.' },
});
const analyzeBatch = vi.fn();
const analyze = vi.fn();
const create = () =>
  createBatchStore({
    analyzeBatch: analyzeBatch as unknown as typeof import('@/lib/api').api.analyzeBatch,
    analyze: analyze as unknown as typeof import('@/lib/api').api.analyze,
  });

describe('magazyn wsadu', () => {
  it('addFiles odrzuca nadmiar ponad 20 plików i nie wysyła ich', () => {
    const store = create();
    const files = Array.from({ length: 25 }, (_, i) => file(`f${i}.pdf`));
    const added = store.addFiles(files);
    expect(added.rows).toHaveLength(20);
    expect(added.rejected).toBe(5);
  });

  it('run() wysyła jeden multipart i mapuje odpowiedzi na wiersze', async () => {
    const store = create();
    store.addFiles([file('ok1.pdf'), file('bad.txt'), file('ok2.pdf')]);
    analyzeBatch.mockResolvedValueOnce({
      results: [ok('ok1.pdf'), fail('bad.txt'), ok('ok2.pdf')],
      ok: 2,
      failed: 1,
    });
    await store.run();
    expect(analyzeBatch).toHaveBeenCalledTimes(1);
    const body = analyzeBatch.mock.calls[0][0] as File[];
    expect(body).toHaveLength(3);
    const rows = store.getSnapshot();
    expect(rows.find((row) => row.filename === 'ok1.pdf')).toMatchObject({
      status: 'done',
    });
    expect(rows.find((row) => row.filename === 'ok1.pdf')?.resultId).toBeTruthy();
    expect(getResult(rows[0].resultId!)?.form.title).toBe('Form');
    expect(rows.find((row) => row.filename === 'bad.txt')).toMatchObject({
      status: 'error',
      error: { code: 'UNSUPPORTED_MEDIA_TYPE', status: 415 },
    });
  });

  it('pusty wsad nie wywołuje API', async () => {
    const store = create();
    await store.run();
    expect(analyzeBatch).not.toHaveBeenCalled();
  });

  it('retryOne wysyła pojedynczy plik przez /analyze', async () => {
    const store = create();
    store.addFiles([file('bad.txt')]);
    analyzeBatch.mockResolvedValueOnce({ results: [fail('bad.txt')], ok: 0, failed: 1 });
    await store.run();
    analyze.mockResolvedValueOnce({
      form: form(),
      metadata: {
        processingTimeMs: 10,
        detectedType: 'pdf',
        warnings: 0,
        extractor: 'StubExtractor',
        partialResult: false,
        partialReasons: [],
      },
    });
    const row = store.getSnapshot()[0];
    await store.retryOne(row.id);
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(analyze.mock.calls[0][0].name).toBe('bad.txt');
    expect(store.getSnapshot()[0]).toMatchObject({ status: 'done' });
  });

  it('brakujący plik w odpowiedzi (filename null) zostaje wierszem błędu bez nazwy', async () => {
    const store = create();
    store.addFiles([file('a.pdf')]);
    analyzeBatch.mockResolvedValueOnce({
      results: [fail(null)],
      ok: 0,
      failed: 1,
    });
    await store.run();
    expect(store.getSnapshot()[0]).toMatchObject({ status: 'error' });
  });
});
