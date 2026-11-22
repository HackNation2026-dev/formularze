'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { openJson } from '@/features/open-json/load';
import { ApplicationShell } from '@/design-system/templates/AppShell/Connected';
import { Dropzone } from '@/design-system/organisms/Dropzone';
import { Text } from '@/design-system/atoms/Text';
import { Callout } from '@/design-system/molecules/Callout';
export default function Page() {
  const t = useTranslations('open');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  async function load(files: File[]) {
    if (!files[0]) return;
    setError(false);
    setLoading(true);
    try {
      const id = await openJson(files[0]);
      router.push(`/results/${id}/json`);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  return (
    <ApplicationShell>
      <div className="grid gap-4">
        <Text as="h2" variant="heading">
          {t('title')}
        </Text>
        <Dropzone
          label={t('description')}
          action={t('choose')}
          accept=".json,application/json"
          multiple={false}
          disabled={loading}
          onFiles={(files) => void load(files)}
        />
        {loading && <Text role="status">{t('loading')}</Text>}
        {error && (
          <Callout tone="danger" role="alert">
            {t('invalid')}
          </Callout>
        )}
      </div>
    </ApplicationShell>
  );
}
