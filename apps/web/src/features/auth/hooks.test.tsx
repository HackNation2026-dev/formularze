import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { tokenStore, ApiError } from '@/lib/api';
import { useToken, useUnauthorized } from './hooks';
const replace = vi.hoisted(() => vi.fn());
const router = { replace };
vi.mock('@/i18n/navigation', () => ({ useRouter: () => router }));
afterEach(() => {
  cleanup();
  replace.mockClear();
});
it('subskrybuje zapis i usunięcie tokenu', () => {
  const { result } = renderHook(useToken);
  expect(result.current).toBeNull();
  act(() => tokenStore.set('jwt'));
  expect(result.current).toBe('jwt');
  act(() => tokenStore.set(null));
  expect(result.current).toBeNull();
});
it('bez tokenu pozwala korzystać z aplikacji, przekierowuje dopiero po 401', () => {
  const { rerender } = renderHook(
    ({ error }: { error: unknown }) => useUnauthorized(error),
    { initialProps: { error: null as unknown } },
  );
  expect(replace).not.toHaveBeenCalled();
  tokenStore.set('expired');
  rerender({ error: new ApiError('UNAUTHORIZED', 401, 'expired') });
  expect(tokenStore.get()).toBeNull();
  expect(replace).toHaveBeenCalledWith('/login?reason=401&returnTo=upload');
});
