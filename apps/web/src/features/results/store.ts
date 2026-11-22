'use client';
import { useSyncExternalStore } from 'react';
import type { AnalyzeResult, FormDefinition } from '@/lib/api/schemas';
export interface StoredResult {
  id: string;
  form: FormDefinition;
  meta: Partial<AnalyzeResult['metadata']>;
  sourceFile?: File;
  source: 'api' | 'local';
}
const results = new Map<string, StoredResult>();
let lastOpened: string | undefined;
const listeners = new Set<() => void>();
export function putResult(
  input: Omit<StoredResult, 'source'> & { source?: StoredResult['source'] },
): StoredResult {
  const result: StoredResult = { ...input, source: input.source ?? 'api' };
  results.set(result.id, result);
  listeners.forEach((listener) => listener());
  return result;
}
export function getResult(id: string): StoredResult | undefined {
  return results.get(id);
}
export function useResult(id: string) {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => getResult(id),
    () => undefined,
  );
}

export function markResultOpened(id: string) {
  if (lastOpened === id || !results.has(id)) return;
  lastOpened = id;
  listeners.forEach((listener) => listener());
}
export function useLastResultId() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => lastOpened,
    () => undefined,
  );
}
export function downloadResult(id: string) {
  const result = getResult(id);
  if (!result) return;
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(result.form, null, 2)], {
      type: 'application/json',
    }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `konfiguracja-${id}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
