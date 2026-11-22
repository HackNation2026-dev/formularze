'use client';
import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { useTheme } from '../providers';
import type { Theme } from '@/lib/theme';

export type PageName =
  | 'home'
  | 'login'
  | 'upload'
  | 'open'
  | 'settings'
  | 'design-system'
  | 'json'
  | 'validation'
  | 'preview';
export function Placeholder({ name }: { name: PageName }) {
  const t = useTranslations('common');
  const locale = useLocale();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  return (
    <main className="mx-auto max-w-3xl p-4">
      <header className="flex flex-wrap items-center gap-4">
        <Link href="/">{t('title')}</Link>
        <nav aria-label={t('language')} className="flex gap-3">
          {(['pl', 'en'] as const).map((value) => (
            <Link
              key={value}
              href={pathname}
              locale={value}
              aria-current={value === locale ? 'true' : undefined}
              onClick={() => {
                try {
                  localStorage.setItem('formgen.locale', value);
                } catch {
                  /* Język wynika też z adresu URL. */
                }
              }}
            >
              {value.toUpperCase()}
            </Link>
          ))}
        </nav>
        <label>
          {t('theme')}{' '}
          <select
            value={theme}
            onChange={(event) => setTheme(event.target.value as Theme)}
          >
            {(['Light', 'Dark', 'System'] as const).map((value) => (
              <option key={value} value={value}>
                {t(
                  value === 'Light'
                    ? 'light'
                    : value === 'Dark'
                      ? 'dark'
                      : 'system',
                )}
              </option>
            ))}
          </select>
        </label>
      </header>
      <h1 className="my-6 text-2xl font-semibold">{t(name)}</h1>
      <p className="rounded-md bg-surface p-4 text-muted">{t('todo')}</p>
      <nav className="my-6 flex flex-wrap gap-4">
        {(
          ['upload', 'open', 'settings', 'login', 'design-system'] as const
        ).map((route) => (
          <Link key={route} href={`/${route}`}>
            {t(route)}
          </Link>
        ))}
      </nav>
    </main>
  );
}
