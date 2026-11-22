'use client';
import { useSyncExternalStore } from 'react';
import type { AnalyzeResult, FormDefinition } from '@/lib/api/schemas';
export interface StoredResult {
  id: string;
  form: FormDefinition;
  meta: Partial<AnalyzeResult['metadata']>;
  sourceFile?: File;
}
const results = new Map<string, StoredResult>();
const listeners = new Set<() => void>();
export function putResult(result: StoredResult): StoredResult {
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
