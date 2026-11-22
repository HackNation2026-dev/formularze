'use client';
import { useTranslations } from 'next-intl';
export default function NotFound() {
  const t = useTranslations('common');
  return (
    <main className="p-4">
      <h1>{t('notFound')}</h1>
    </main>
  );
}
