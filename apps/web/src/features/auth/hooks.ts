'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { tokenStore } from '@/lib/api';
import { useRouter } from '@/i18n/navigation';
export function useToken() {
  return useSyncExternalStore(tokenStore.subscribe, tokenStore.get, () => null);
}
export function useUnauthorized(
  error: unknown,
  returnTo: 'upload' | 'settings' = 'upload',
) {
  const router = useRouter();
  useEffect(() => {
    if (
      error &&
      typeof error === 'object' &&
      'status' in error &&
      error.status === 401
    ) {
      tokenStore.set(null);
      router.replace(`/login?reason=401&returnTo=${returnTo}`);
    }
  }, [error, returnTo, router]);
}
