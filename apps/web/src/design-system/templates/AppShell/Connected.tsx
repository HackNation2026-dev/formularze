'use client';
import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { usePreferences } from '@/features/settings/hooks';
import { useSystemStatus } from '@/features/system/hooks';
import { Button } from '../../atoms/Button';
import { Select } from '../../atoms/Select';
import { StatusChip } from '../../molecules/StatusChip';
import { AppShell } from '../AppShell';
export function PreferenceControls() {
  const t = useTranslations('shell');
  const { locale, setLocale, theme, setTheme } = usePreferences();
  return (
    <>
      <label className="grid gap-1 text-sm">
        {t('language')}
        <Select
          value={locale}
          onChange={(event) => setLocale(event.target.value as 'pl' | 'en')}
        >
          <option value="pl">{t('pl')}</option>
          <option value="en">{t('en')}</option>
        </Select>
      </label>
      <label className="grid gap-1 text-sm">
        {t('theme')}
        <Select
          value={theme}
          onChange={(event) =>
            setTheme(event.target.value as 'Light' | 'Dark' | 'System')
          }
        >
          {(['Light', 'Dark', 'System'] as const).map((value) => (
            <option key={value} value={value}>
              {t(value)}
            </option>
          ))}
        </Select>
      </label>
    </>
  );
}
export function SystemStatus() {
  const t = useTranslations('shell');
  const { status, retry } = useSystemStatus();
  return (
    <div className="flex flex-wrap items-center gap-2" role="status">
      <StatusChip
        tone={
          status === 'ok'
            ? 'success'
            : status === 'loading'
              ? 'neutral'
              : status === 'degraded'
                ? 'warning'
                : 'danger'
        }
      >
        {t(status)}
      </StatusChip>
      {['offline', 'unavailable'].includes(status) && (
        <Button variant="ghost" onClick={retry}>
          {t('retry')}
        </Button>
      )}
    </div>
  );
}
export function ApplicationShell({ children }: { children: ReactNode }) {
  const t = useTranslations('shell');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  return (
    <AppShell
      title={t('title')}
      status={<SystemStatus />}
      controls={<PreferenceControls />}
      navigation={{
        label: t('navigation'),
        items: (['upload', 'open', 'settings'] as const).map((name) => ({
          href: `/${locale}/${name}`,
          label: t(name),
          active: pathname === `/${name}`,
        })),
        onNavigate: (href) => router.push(href.slice(locale.length + 1)),
      }}
    >
      {children}
    </AppShell>
  );
}
