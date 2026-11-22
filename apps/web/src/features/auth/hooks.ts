'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { tokenStore } from '@/lib/api';
import { useRouter } from '@/i18n/navigation';
export function useToken() {
  return useSyncExternalStore(tokenStore.subscribe, tokenStore.get, () => null);
}
export function useUnauthorized(error: unknown, returnTo: string = '/upload') {
  const router = useRouter();
  useEffect(() => {
    if (
      error &&
      typeof error === 'object' &&
      'status' in error &&
      error.status === 401
    ) {
      tokenStore.set(null);
      router.replace(loginHref(returnTo));
    }
  }, [error, returnTo, router]);
}

export function safeReturnTo(value: string | null): string {
  if (value === 'upload' || value === 'settings') return `/${value}`;
  const path = value?.replace(/^\/(pl|en)(?=\/)/, '');
  return path &&
    /^\/(upload|settings|open|results\/[^/]+\/(json|validation|preview))$/.test(
      path,
    )
    ? path
    : '/upload';
}
export function loginHref(returnTo: string) {
  return `/login?reason=401&returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`;
}
