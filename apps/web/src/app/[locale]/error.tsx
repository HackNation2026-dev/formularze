'use client';
import { useTranslations } from 'next-intl';
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('common');
  return (
    <main className="p-4">
      <h1>{t('error')}</h1>
      <button onClick={reset}>{t('retry')}</button>
    </main>
  );
}
