'use client';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useTheme } from '@/app/providers';
export function usePreferences() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  return {
    locale,
    ...useTheme(),
    setLocale(value: 'pl' | 'en') {
      try {
        localStorage.setItem('formgen.locale', value);
      } catch {
        /* Preferencja w adresie. */
      }
      router.replace(pathname, { locale: value });
    },
  };
}
