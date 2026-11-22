import { api, ApiError, type AnalyzeResult, type Formats } from '@/lib/api';

export type QueueStatus = 'queued' | 'processing' | 'done' | 'error';
export interface QueueItem {
  id: string;
  file: File;
  status: QueueStatus;
  error?: ApiError;
  result?: AnalyzeResult;
  clientError?: boolean;
}
export function validateFile(
  file: File,
  formats: Formats,
): ApiError | undefined {
  if (!file.name || !file.size)
    return new ApiError('MISSING_FILE', 400, 'MISSING_FILE');
  if (Array.from(file.name).length > 250 || /[;:<>/\\|'*%$]/.test(file.name))
    return new ApiError('INVALID_FILENAME', 400, 'INVALID_FILENAME');
  if (file.size > formats.max_upload_size_mb * 1024 * 1024)
    return new ApiError('FILE_TOO_LARGE', 413, 'FILE_TOO_LARGE');
  const extension = file.name.includes('.')
    ? file.name.split('.').pop()!.toLowerCase()
    : '';
  if (
    !formats.extensions
      .map((value) => value.replace(/^\./, '').toLowerCase())
      .includes(extension)
  )
    return new ApiError(
      'UNSUPPORTED_MEDIA_TYPE',
      415,
      'UNSUPPORTED_MEDIA_TYPE',
    );
}
export function canRetry(item: QueueItem) {
  return (
    item.status === 'error' &&
    !item.clientError &&
    ![
      'FILE_TOO_LARGE',
      'UNSUPPORTED_MEDIA_TYPE',
      'MIME_MISMATCH',
      'INVALID_FILENAME',
      'MISSING_FILE',
      'INVALID_OUTPUT',
      'AUTH_MISCONFIGURED',
    ].includes(item.error?.code ?? '')
  );
}

/** Magazyn karty: zachowuje pliki przy nawigacji SPA, nie zapisuje ich na dysku. */
export function createQueueStore(
  analyze: typeof api.analyze = (file, signal) => api.analyze(file, signal),
) {
  let items: QueueItem[] = [];
  const listeners = new Set<() => void>();
  let active: { id: string; controller: AbortController } | undefined;
  let running: Promise<void> | undefined;
  const emit = () => listeners.forEach((listener) => listener());
  const update = (id: string, change: Partial<QueueItem>) => {
    items = items.map((item) =>
      item.id === id ? { ...item, ...change } : item,
    );
    emit();
  };
  const store = {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => items,
    add(files: File[], formats: Formats) {
      const added = files.map((file): QueueItem => {
        const error = validateFile(file, formats);
        return {
          id: crypto.randomUUID(),
          file,
          status: error ? 'error' : 'queued',
          error,
          clientError: !!error,
        };
      });
      items = [...items, ...added];
      emit();
      return added;
    },
    addLocal(file: File, result: AnalyzeResult) {
      const id = `local-${crypto.randomUUID()}`;
      items = [...items, { id, file, status: 'done', result }];
      emit();
      return id;
    },
    getResult: (id: string) => items.find((item) => item.id === id)?.result,
    getItem: (id: string) => items.find((item) => item.id === id),
    remove(id: string) {
      items = items.filter((item) => item.id !== id);
      emit();
      // Kolejny plik zaczyna się dopiero po zakończeniu/anulowaniu bieżącego fetch.
      if (active?.id === id) active.controller.abort();
    },
    retry(id: string) {
      const item = items.find((entry) => entry.id === id);
      if (item && canRetry(item))
        update(id, { status: 'queued', error: undefined });
    },
    run(onUnauthorized?: () => void, onSuccess?: (id: string) => void) {
      if (running) return running;
      async function drain() {
        let item: QueueItem | undefined;
        while ((item = items.find((entry) => entry.status === 'queued'))) {
          const id = item.id;
          const controller = new AbortController();
          active = { id, controller };
          update(id, { status: 'processing', error: undefined });
          try {
            const result = await analyze(item.file, controller.signal);
            if (items.some((entry) => entry.id === id)) {
              update(id, { status: 'done', result });
              onSuccess?.(id);
            }
          } catch (cause) {
            if (!items.some((entry) => entry.id === id)) continue;
            const error =
              cause instanceof ApiError
                ? cause
                : new ApiError('NETWORK_ERROR', 0, 'NETWORK_ERROR');
            update(id, { status: 'error', error });
            if (error.status === 401) {
              onUnauthorized?.();
              break;
            }
          } finally {
            active = undefined;
          }
        }
      }
      running = drain().finally(() => {
        running = undefined;
        emit();
      });
      return running;
    },
  };
  return store;
}
export const queueStore = createQueueStore();
