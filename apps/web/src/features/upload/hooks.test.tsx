import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { queueStore } from './store';
import { useQueue } from './hooks';
afterEach(() => {
  cleanup();
  for (const item of queueStore.getSnapshot()) queueStore.remove(item.id);
});
it('subskrybuje dodawanie i usuwanie plików', () => {
  const queue = renderHook(useQueue);
  let id = '';
  act(() => {
    [{ id }] = queueStore.add([new File(['data'], 'a.pdf')], {
      extensions: ['pdf'],
      max_upload_size_mb: 1,
    });
  });
  expect(queue.result.current).toHaveLength(1);
  act(() => queueStore.remove(id));
  expect(queue.result.current).toHaveLength(0);
});
