'use client';
import { useUnauthorized, loginHref } from '@/features/auth/hooks';
import { usePathname } from '@/i18n/navigation';
import { useEffect } from 'react';
import NextLink from 'next/link';
import { target, focus } from '../../atoms/styles';
import { useLocale, useTranslations } from 'next-intl';
import { markResultOpened, useResult } from '@/features/results/store';
import { jsonLabels, previewLabels } from '@/features/results/labels';
import { useResultValidation } from '@/features/results/useResultValidation';
import type { FormDefinition } from '@/lib/api/schemas';
import { ResultLayout } from '../ResultLayout';
import { JsonViewer } from '../../organisms/JsonViewer';
import {
  ValidationList,
  type ValidationLabels,
} from '../../organisms/ValidationList';
import { FormRenderer } from '../../organisms/FormRenderer';
import { Button, Link, Textarea } from '../../atoms';
import { EmptyState, FormField, Callout } from '../../molecules';
export type ResultMode = 'json' | 'validation' | 'preview';
export function ResultView({ id, mode }: { id: string; mode: ResultMode }) {
  const result = useResult(id);
  useEffect(() => {
    if (result) markResultOpened(id);
  }, [id, result]);
  const locale = useLocale();
  const t = useTranslations('results');
  const p = useTranslations('preview');
  if (!result)
    return (
      <ResultLayout
        as="section"
        title={t('title')}
        navigationLabel={t('tabs')}
        tabs={[]}
        active={mode}
      >
        <EmptyState
          title={t('notFound')}
          action={<Link href={`/${locale}/upload`}>{t('upload')}</Link>}
        />
      </ResultLayout>
    );
  return (
    <ResultLayout
      as="section"
      title={result.form.title || t('title')}
      navigationLabel={t('tabs')}
      tabs={(['json', 'validation', 'preview'] as const).map((tab) => ({
        id: tab,
        label: t(tab),
        href: `/${locale}/results/${encodeURIComponent(id)}/${tab}`,
      }))}
      active={mode}
    >
      {result.meta.extractor === 'HeuristicExtractor' && (
        <Callout>{t('degraded')}</Callout>
      )}
      {mode === 'json' && (
        <JsonViewer
          value={result.form}
          labels={jsonLabels(t)}
          filename={`konfiguracja-${id.replace(/[^a-zA-Z0-9-]/g, '')}.json`}
        />
      )}
      {mode === 'validation' && <Validation form={result.form} />}
      {mode === 'preview' && (
        <FormRenderer form={result.form} labels={previewLabels(p)} />
      )}
    </ResultLayout>
  );
}
function Validation({ form }: { form: FormDefinition }) {
  const t = useTranslations('results');
  const locale = useLocale();
  const state = useResultValidation(form);
  const pathname = usePathname();
  useUnauthorized(state.error, pathname);
  const labels = Object.fromEntries(
    [
      'code',
      'path',
      'message',
      'severity',
      'filter',
      'error',
      'warning',
      'noIssues',
      'noMatches',
    ].map((key) => [key, t(key)]),
  ) as ValidationLabels;
  return (
    <section className="grid min-w-0 gap-4">
      <FormField
        label={t('samples')}
        helper={t('samplesHelp')}
        error={state.invalidSamples ? t('invalidSamples') : undefined}
      >
        <Textarea
          value={state.samples}
          onChange={(event) => state.setSamples(event.target.value)}
          spellCheck={false}
        />
      </FormField>
      <Button onClick={state.validate} loading={state.isPending}>
        {t('validate')}
      </Button>
      {state.isError && (
        <Callout role="alert" tone="danger">
          {t(state.errorKey, { status: state.statusCode })}
          {state.errorKey === 'unauthorized' && (
            <NextLink
              className={`${target} ${focus} inline-flex items-center text-primary underline`}
              href={`/${locale}${loginHref(pathname)}`}
            >
              {t('login')}
            </NextLink>
          )}
        </Callout>
      )}
      {state.data ? (
        <>
          {(state.data.errors.length > 0 ||
            state.data.warnings.length > 0 ||
            (state.data.sample_errors.length === 0 &&
              state.data.sample_unknown.length === 0)) && (
            <ValidationList
              issues={[...state.data.errors, ...state.data.warnings]}
              labels={labels}
            />
          )}
          {state.data.sample_errors.length > 0 && (
            <Callout tone="danger" title={t('sampleErrors')}>
              <ul>
                {state.data.sample_errors.map((error, index) => (
                  <li key={index}>
                    {error.techName}: {JSON.stringify(error.value)} —{' '}
                    {error.failed.join(', ')}
                  </li>
                ))}
              </ul>
            </Callout>
          )}
          {state.data.sample_unknown.length > 0 && (
            <Callout tone="warning" title={t('sampleUnknown')}>
              {state.data.sample_unknown.join(', ')}
            </Callout>
          )}
        </>
      ) : (
        !state.isError && <EmptyState title={t('notValidated')} />
      )}
    </section>
  );
}
