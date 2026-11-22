'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { batchStore, MAX_BATCH_FILES, useBatch, type BatchRow } from '@/features/batch';
import { ApplicationShell } from '@/design-system/templates/AppShell/Connected';
import { Dropzone } from '@/design-system/organisms/Dropzone';
import { FileQueue } from '@/design-system/organisms/FileQueue';
import { Button } from '@/design-system/atoms/Button';
import { Text } from '@/design-system/atoms/Text';
import { Callout } from '@/design-system/molecules/Callout';
import { EmptyState } from '@/design-system/molecules/EmptyState';

export default function Page() {
  const t = useTranslations('batch');
  const upload = useTranslations('upload');
  const router = useRouter();
  const rows: BatchRow[] = useBatch();
  const [rejected, setRejected] = useState(0);
  const done = rows.filter((row) => row.status === 'done').length;
  const errors = rows.filter((row) => row.status === 'error');
  const canRun = rows.some((row) => row.status === 'pending');
  return (
    <ApplicationShell>
      <div className="grid gap-6">
        <Text as="h2" variant="heading">
          {t('title')}
        </Text>
        <Dropzone
          label={t('drop')}
          action={t('choose')}
          disabled={false}
          helper={t('limit', { max: MAX_BATCH_FILES })}
          onFiles={(files) => {
            const added = batchStore.addFiles(files);
            setRejected(added.rejected);
          }}
        />
        {rejected > 0 && (
          <Callout role="alert" tone="warning">
            {t('tooMany', { count: rejected })}
          </Callout>
        )}
        {rows.length > 0 && (
          <Button onClick={() => void batchStore.run()} disabled={!canRun}>
            {t('analyze')}
          </Button>
        )}
        {rows.length > 0 && (
          <Text role="status" variant="caption">
            {t('summary', { done, total: rows.length })}
          </Text>
        )}
        {errors.length > 0 && (
          <Callout role="status" tone="warning">
            {t('errorsSummary', { failed: errors.length })}
          </Callout>
        )}
        {!rows.length ? (
          <EmptyState title={t('empty')} description={t('emptyDescription')} />
        ) : (
          <FileQueue
            label={t('queue')}
            rows={rows.map((row) => ({
              id: row.id,
              filename: row.filename,
              state: row.status === 'pending' ? 'queued' : row.status,
              statusLabel:
                row.status === 'pending'
                  ? upload('queued')
                  : row.status === 'done'
                    ? upload('done')
                    : upload('error'),
              error: row.error && {
                code: row.error.code,
                status: row.error.status,
                message: upload.has(`errors.${row.error.code}`)
                  ? upload(`errors.${row.error.code}`)
                  : upload('errors.generic', { status: row.error.status }),
              },
              actions: (
                <div className="flex flex-wrap gap-2">
                  {row.status === 'done' && row.resultId && (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        router.push(`/results/${row.resultId}/preview`)
                      }
                    >
                      {t('open')}
                    </Button>
                  )}
                  {row.status === 'error' && (
                    <Button
                      variant="secondary"
                      onClick={() => void batchStore.retryOne(row.id)}
                    >
                      {upload('retry')}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => batchStore.remove(row.id)}
                  >
                    {upload('remove')}
                  </Button>
                </div>
              ),
            }))}
          />
        )}
      </div>
    </ApplicationShell>
  );
}
