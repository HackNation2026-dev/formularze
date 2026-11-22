import { getResult } from '@/features/results';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, type AnalyzeResult } from '@/lib/api';
import { canRetry, createQueueStore, validateFile } from './store';
const formats = { extensions: ['pdf', 'png'], max_upload_size_mb: 1 };
const file = (name = 'form.pdf') => new File(['data'], name);
const result: AnalyzeResult = {
  form: { title: 'Form', tabs: [], flow: { links: [] } },
  metadata: {
    extractor: 'StubExtractor',
    processingTimeMs: 5,
    detectedType: 'pdf',
    warnings: 0,
  },
};
describe('walidacja pliku', () => {
  it('korzysta z formatów, akceptuje wielkie litery i granicę 250 znaków', () => {
    expect(
      validateFile(file('a'.repeat(246) + '.PDF'), formats),
    ).toBeUndefined();
    expect(validateFile(file('a'.repeat(247) + '.pdf'), formats)?.code).toBe(
      'INVALID_FILENAME',
    );
    expect(validateFile(file('a.docx'), formats)?.status).toBe(415);
    expect(validateFile(file('bez-rozszerzenia'), formats)?.status).toBe(415);
    expect(validateFile(new File([''], 'a.pdf'), formats)?.code).toBe(
      'MISSING_FILE',
    );
  });
  it.each(Array.from(";:<>/\\|'*%$"))('odrzuca znak %s', (char) =>
    expect(validateFile(file(`a${char}.pdf`), formats)?.code).toBe(
      'INVALID_FILENAME',
    ),
  );
  it('rozróżnia rozmiar równy limitowi i przekroczony', () => {
    expect(
      validateFile(new File([new Uint8Array(1024 ** 2)], 'a.pdf'), formats),
    ).toBeUndefined();
    expect(
      validateFile(new File([new Uint8Array(1024 ** 2 + 1)], 'a.pdf'), formats)
        ?.status,
    ).toBe(413);
  });
});
describe('kolejka', () => {
  it('nie wysyła niepoprawnych plików', async () => {
    const analyze = vi.fn().mockResolvedValue(result);
    const queue = createQueueStore(analyze);
    queue.add([file('a.exe')], formats);
    await queue.run();
    expect(analyze).not.toHaveBeenCalled();
    expect(canRetry(queue.getSnapshot()[0])).toBe(false);
  });
  it('wysyła jedno żądanie naraz, także przy podwójnym uruchomieniu', async () => {
    let resolve!: (value: AnalyzeResult) => void;
    const analyze = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<AnalyzeResult>((done) => {
            resolve = done;
          }),
      )
      .mockResolvedValue(result);
    const queue = createQueueStore(analyze);
    queue.add([file('a.pdf'), file('b.pdf')], formats);
    const first = queue.run();
    const second = queue.run();
    expect(first).toBe(second);
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(queue.getSnapshot().map((item) => item.status)).toEqual([
      'processing',
      'queued',
    ]);
    resolve(result);
    await first;
    expect(analyze).toHaveBeenCalledTimes(2);
    expect(queue.getSnapshot().every((item) => item.status === 'done')).toBe(
      true,
    );
  });
  it('zachowuje kolejkę po 401 i pozwala ponowić po logowaniu', async () => {
    const analyze = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('UNAUTHORIZED', 401, 'token'))
      .mockResolvedValue(result);
    const queue = createQueueStore(analyze);
    const [item] = queue.add([file(), file('b.pdf')], formats);
    const unauthorized = vi.fn();
    await queue.run(unauthorized);
    expect(unauthorized).toHaveBeenCalledOnce();
    expect(queue.getSnapshot().map((item) => item.status)).toEqual([
      'error',
      'queued',
    ]);
    queue.retry(item.id);
    await queue.run();
    expect(queue.getItem(item.id)?.resultId).toBe(item.id);
    expect(getResult(item.id)).toMatchObject({
      form: result.form,
      meta: result.metadata,
      source: 'api',
    });
    expect(analyze).toHaveBeenCalledTimes(3);
  });
  it('anuluje usunięty plik i nie wskrzesza wyniku ani nie uruchamia równoległego żądania', async () => {
    let resolve!: (value: AnalyzeResult) => void;
    let signal: AbortSignal | undefined;
    const analyze = vi
      .fn()
      .mockImplementationOnce((_file: File, abort: AbortSignal) => {
        signal = abort;
        return new Promise<AnalyzeResult>((done) => {
          resolve = done;
        });
      })
      .mockResolvedValue(result);
    const queue = createQueueStore(analyze);
    const [a, b] = queue.add([file('a.pdf'), file('b.pdf')], formats);
    const success = vi.fn();
    const running = queue.run(undefined, success);
    queue.remove(a.id);
    queue.run();
    expect(signal?.aborted).toBe(true);
    expect(analyze).toHaveBeenCalledTimes(1);
    resolve(result);
    await running;
    expect(queue.getItem(a.id)).toBeUndefined();
    expect(queue.getItem(b.id)?.status).toBe('done');
    expect(success).toHaveBeenCalledExactlyOnceWith(b.id);
  });
  it('usuwa oczekujący plik bez analizy; ponawia timeout', async () => {
    const analyze = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('PROCESSING_TIMEOUT', 504, 'timeout'))
      .mockResolvedValue(result);
    const queue = createQueueStore(analyze);
    const [a, b] = queue.add([file('a.pdf'), file('b.pdf')], formats);
    queue.remove(b.id);
    await queue.run();
    expect(canRetry(queue.getItem(a.id)!)).toBe(true);
    queue.retry(a.id);
    await queue.run();
    expect(queue.getItem(a.id)?.status).toBe('done');
    expect(analyze).toHaveBeenCalledTimes(2);
  });
});
