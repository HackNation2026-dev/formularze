import { expect, it, vi } from 'vitest';
import { tokenStore } from './token-store';

it('zapisuje, usuwa token i powiadamia subskrybenta', () => {
  const listener = vi.fn();
  const unsubscribe = tokenStore.subscribe(listener);
  tokenStore.set('testowy');
  expect(tokenStore.get()).toBe('testowy');
  expect(localStorage.getItem('formgen.token')).toBe('testowy');
  tokenStore.set(null);
  expect(tokenStore.get()).toBeNull();
  expect(listener).toHaveBeenCalledTimes(2);
  unsubscribe();
  tokenStore.set('kolejny');
  expect(listener).toHaveBeenCalledTimes(2);
});
