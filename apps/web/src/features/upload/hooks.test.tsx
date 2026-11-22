import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { queueStore } from './store';
import { useQueue, useResult } from './hooks';
afterEach(() => {
  cleanup();
  for (const item of queueStore.getSnapshot()) queueStore.remove(item.id);
});
it('subskrybuje kolejkę i wynik przy dodawaniu i usuwaniu', () => {
  const queue = renderHook(useQueue);
  let id = '';
  act(() => {
    id = queueStore.addLocal(new File(['{}'], 'local.json'), {
      form: { title: 'Local', tabs: [], flow: { links: [] } },
      metadata: {
        extractor: null,
        detectedType: null,
        processingTimeMs: null,
        warnings: null,
      },
    });
  });
  const result = renderHook(() => useResult(id));
  expect(queue.result.current).toHaveLength(1);
  expect(result.result.current?.form.title).toBe('Local');
  act(() => queueStore.remove(id));
  expect(queue.result.current).toHaveLength(0);
  expect(result.result.current).toBeUndefined();
});
