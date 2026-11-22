'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { tokenStore, useFormats, type ApiError } from '@/lib/api';
import { useUnauthorized } from '@/features/auth/hooks';
import {
  queueStore,
  useQueue,
  canRetry,
  type QueueItem,
} from '@/features/upload';
import { ApplicationShell } from '@/design-system/templates/AppShell/Connected';
import { MasterDetail } from '@/design-system/templates/MasterDetail';
import { Dropzone } from '@/design-system/organisms/Dropzone';
import { FileQueue } from '@/design-system/organisms/FileQueue';
import { BottomSheet } from '@/design-system/organisms/BottomSheet';
import { SidePanel } from '@/design-system/organisms/SidePanel';
import { Button } from '@/design-system/atoms/Button';
import { Text } from '@/design-system/atoms/Text';
import { Skeleton } from '@/design-system/atoms/Skeleton';
import { Callout } from '@/design-system/molecules/Callout';
import { KeyValue } from '@/design-system/molecules/KeyValue';
import { EmptyState } from '@/design-system/molecules/EmptyState';
function errorMessage(
  error: ApiError,
  t: ReturnType<typeof useTranslations<'upload'>>,
) {
  const key = `errors.${error.code}`;
  return t.has(key) ? t(key) : t('errors.generic', { status: error.status });
}
function FileDetails({ item }: { item: QueueItem }) {
  const t = useTranslations('upload');
  const shell = useTranslations('shell');
  const router = useRouter();
  const metadata = item.result?.metadata;
  return (
    <>
      <Text className="break-all">{item.file.name}</Text>
      <KeyValue label={t('size')} value={item.file.size} />
      {(['extractor', 'time', 'type', 'warnings'] as const).map((key) => (
        <KeyValue
          key={key}
          label={t(key)}
          value={
            {
              extractor: metadata?.extractor,
              time: metadata?.processingTimeMs,
              type: metadata?.detectedType,
              warnings: metadata?.warnings,
            }[key] ?? shell('unknown')
          }
        />
      ))}
      {item.error && (
        <Callout tone="danger">
          {item.error.code} · {errorMessage(item.error, t)}
        </Callout>
      )}
      {metadata?.extractor === 'HeuristicExtractor' && (
        <Callout>{t('degraded')}</Callout>
      )}
      {item.result && (
        <Button onClick={() => router.push(`/results/${item.id}/json`)}>
          {t('result')}
        </Button>
      )}
    </>
  );
}
export default function Page() {
  const t = useTranslations('upload');
  const shell = useTranslations('shell');
  const formats = useFormats();
  useUnauthorized(formats.error);
  const items = useQueue();
  const [selected, setSelected] = useState<string | null>(null);
  const router = useRouter();
  const detail = items.find((item) => item.id === selected);
  const close = () => setSelected(null);
  function run() {
    void queueStore.run(() => {
      tokenStore.set(null);
      router.replace('/login?reason=401&returnTo=upload');
    });
  }
  return (
    <ApplicationShell>
      <div className="grid gap-6">
        <Text as="h2" variant="heading">
          {t('title')}
        </Text>
        {formats.isPending && (
          <div role="status" aria-label={t('loading')}>
            <Skeleton label={t('loading')} />
          </div>
        )}
        {formats.isError && (
          <Callout role="alert" tone="danger">
            {t('formatsError')}
            <Button variant="ghost" onClick={() => void formats.refetch()}>
              {shell('retry')}
            </Button>
          </Callout>
        )}
        <MasterDetail
          master={
            <>
              <Dropzone
                label={t('drop')}
                action={t('choose')}
                disabled={!formats.data}
                accept={formats.data?.extensions
                  .map((value) => `.${value.replace(/^\./, '')}`)
                  .join(',')}
                helper={
                  formats.data
                    ? t('formats', {
                        extensions: formats.data.extensions.join(', '),
                        limit: formats.data.max_upload_size_mb,
                      })
                    : undefined
                }
                onFiles={(files) => {
                  if (formats.data) queueStore.add(files, formats.data);
                }}
              />
              <Text as="h3" variant="heading">
                {t('queue')}
              </Text>
              {!items.length ? (
                <EmptyState
                  title={t('empty')}
                  description={t('emptyDescription')}
                />
              ) : (
                <>
                  <Text role="status" variant="caption">
                    {t('summary', {
                      done: items.filter((item) => item.status === 'done')
                        .length,
                      total: items.length,
                    })}
                  </Text>
                  <Button
                    disabled={
                      !items.some((item) => item.status === 'queued') ||
                      items.some((item) => item.status === 'processing')
                    }
                    onClick={run}
                  >
                    {t('analyze')}
                  </Button>
                  <FileQueue
                    label={t('queue')}
                    rows={items.map((item) => ({
                      id: item.id,
                      filename: item.file.name,
                      state: item.status,
                      statusLabel: t(item.status),
                      error: item.error && {
                        code: item.error.code,
                        status: item.error.status,
                        message: errorMessage(item.error, t),
                      },
                      details:
                        item.result?.metadata.extractor ===
                        'HeuristicExtractor' ? (
                          <Callout>{t('degraded')}</Callout>
                        ) : undefined,
                      actions: (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="ghost"
                            onClick={() => setSelected(item.id)}
                          >
                            {t('details')}
                          </Button>
                          {canRetry(item) && (
                            <Button
                              variant="secondary"
                              onClick={() => {
                                queueStore.retry(item.id);
                                run();
                              }}
                            >
                              {t('retry')}
                            </Button>
                          )}
                          {item.result && (
                            <Button
                              variant="secondary"
                              onClick={() =>
                                router.push(`/results/${item.id}/json`)
                              }
                            >
                              {t('result')}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            onClick={() => queueStore.remove(item.id)}
                          >
                            {t('remove')}
                          </Button>
                        </div>
                      ),
                    }))}
                  />
                </>
              )}
            </>
          }
          detail={
            detail && (
              <SidePanel
                title={t('details')}
                closeLabel={shell('close')}
                onClose={close}
              >
                <FileDetails item={detail} />
              </SidePanel>
            )
          }
        />
        <BottomSheet
          open={!!detail}
          title={t('details')}
          closeLabel={shell('close')}
          onClose={close}
        >
          {detail && <FileDetails item={detail} />}
        </BottomSheet>
      </div>
    </ApplicationShell>
  );
}
