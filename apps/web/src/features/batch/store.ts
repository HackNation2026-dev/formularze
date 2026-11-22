'use client';
import { useSyncExternalStore } from 'react';
import type { BatchResult } from '@/lib/api/schemas';
import { api } from '@/lib/api/client';
import { putResult } from '@/features/results/store';
import { ApiError } from '@/lib/api/errors';

export const MAX_BATCH_FILES = 20;

export interface BatchRow {
  id: string;
  file: File;
  filename: string;
  status: 'pending' | 'done' | 'error';
  resultId?: string;
  error?: { code: string; status: number; message: string };
}

export type BatchDeps = Pick<typeof api, 'analyzeBatch' | 'analyze'>;

/** Wsad do /analyze-batch: jeden multipart, statusy per plik, powtórka przez /analyze. */
export function createBatchStore(deps: BatchDeps = api) {
  let rows: BatchRow[] = [];
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  const update = (id: string, change: Partial<BatchRow>) => {
    rows = rows.map((row) => (row.id === id ? { ...row, ...change } : row));
    emit();
  };
  let running = false;
  const store = {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => rows,
    addFiles(files: File[]): { rows: BatchRow[]; rejected: number } {
      const room = Math.max(0, MAX_BATCH_FILES - rows.length);
      const accepted = files.slice(0, room);
      const rejected = files.length - accepted.length;
      const added = accepted.map(
        (file): BatchRow => ({
          id: crypto.randomUUID(),
          file,
          filename: file.name,
          status: 'pending',
        }),
      );
      rows = [...rows, ...added];
      emit();
      return { rows: added, rejected };
    },
    remove(id: string) {
      rows = rows.filter((row) => row.id !== id);
      emit();
    },
    clear() {
      rows = [];
      emit();
    },
    async run(): Promise<void> {
      if (running) return;
      const pending = rows.filter((row) => row.status === 'pending');
      if (!pending.length) return;
      running = true;
      try {
        const response: BatchResult = await deps.analyzeBatch(
          pending.map((row) => row.file),
        );
        response.results.forEach((result, index) => {
          const row = pending[index];
          if (!row) return;
          if ('form' in result) {
            const stored = putResult({
              id: crypto.randomUUID(),
              form: result.form,
              meta: {
                processingTimeMs: result.processing_time_ms,
                detectedType: result.detected_type,
                warnings: result.warnings,
                extractor: result.extractor,
                partialResult: result.partial ?? false,
                partialReasons: result.partial_reasons ?? [],
              },
            });
            update(row.id, { status: 'done', resultId: stored.id });
          } else {
            update(row.id, {
              status: 'error',
              error: {
                code: result.error.code,
                status: result.status,
                message: result.error.message,
              },
            });
          }
        });
      } catch (cause) {
        const error =
          cause instanceof ApiError
            ? { code: cause.code, status: cause.status, message: cause.message }
            : { code: 'NETWORK_ERROR', status: 0, message: String(cause) };
        rows = rows.map((row) =>
          row.status === 'pending' ? { ...row, status: 'error', error } : row,
        );
        emit();
      } finally {
        running = false;
      }
    },
    async retryOne(id: string): Promise<void> {
      const row = rows.find((item) => item.id === id);
      if (!row || row.status !== 'error') return;
      update(id, { status: 'pending', error: undefined });
      try {
        const result = await deps.analyze(row.file);
        const stored = putResult({
          id: crypto.randomUUID(),
          form: result.form,
          meta: result.metadata,
        });
        update(id, { status: 'done', resultId: stored.id });
      } catch (cause) {
        const error =
          cause instanceof ApiError
            ? { code: cause.code, status: cause.status, message: cause.message }
            : { code: 'NETWORK_ERROR', status: 0, message: String(cause) };
        update(id, { status: 'error', error });
      }
    },
  };
  return store;
}

export const batchStore = createBatchStore();

export function useBatch(): BatchRow[] {
  return useSyncExternalStore(batchStore.subscribe, batchStore.getSnapshot);
}
