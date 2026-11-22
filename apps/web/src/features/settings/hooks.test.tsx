import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { usePreferences } from './hooks';
const mocks = vi.hoisted(() => ({ replace: vi.fn(), theme: vi.fn() }));
const router = { replace: mocks.replace };
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/upload',
}));
vi.mock('next-intl', () => ({ useLocale: () => 'pl' }));
vi.mock('@/app/providers', () => ({
  useTheme: () => ({ theme: 'System', setTheme: mocks.theme }),
}));
afterEach(cleanup);
it('przełącza język przez SPA i zapisuje preferencję', () => {
  const { result } = renderHook(usePreferences);
  result.current.setLocale('en');
  expect(localStorage.getItem('formgen.locale')).toBe('en');
  expect(mocks.replace).toHaveBeenCalledWith('/upload', { locale: 'en' });
  result.current.setTheme('Dark');
  expect(mocks.theme).toHaveBeenCalledWith('Dark');
});
it('zachowuje powód 401 i docelową trasę przy zmianie języka', () => {
  window.history.replaceState(
    null,
    '',
    '/pl/upload?reason=401&returnTo=settings',
  );
  const { result } = renderHook(usePreferences);
  result.current.setLocale('en');
  expect(mocks.replace).toHaveBeenLastCalledWith(
    '/upload?reason=401&returnTo=settings',
    { locale: 'en' },
  );
  window.history.replaceState(null, '', '/');
});
