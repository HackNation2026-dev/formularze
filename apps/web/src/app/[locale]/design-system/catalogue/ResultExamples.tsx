'use client';
import { NextIntlClientProvider } from 'next-intl';
import NextLink from 'next/link';
import { target, focus } from '@/design-system/atoms/styles';
import { messages } from '@/i18n/messages';
import { formDefinitionSchema } from '@/lib/api/schemas';
import tax from '@/mocks/fixtures/05_nadplata_podatku.json';
import { putResult } from '@/features/results';
import { jsonLabels, previewLabels } from '@/features/results/labels';
import { JsonViewer as Viewer } from '@/design-system/organisms/JsonViewer';
import { ValidationList as List } from '@/design-system/organisms/ValidationList';
import { FormRenderer as Renderer } from '@/design-system/organisms/FormRenderer';
import { ResultLayout as Layout } from '@/design-system/templates/ResultLayout';
import type { ExampleProps } from './shared';
function copy(t: ExampleProps['t']) {
  const locale: 'pl' | 'en' =
    t.title === messages.pl['design-system'].title ? 'pl' : 'en';
  return { locale, r: messages[locale].results, p: messages[locale].preview };
}
export function JsonViewer({ t }: ExampleProps) {
  const { r } = copy(t);
  return (
    <>
      <Viewer
        value={{
          title: t.title,
          number: 42,
          empty: null,
          array: [true, false],
        }}
        labels={jsonLabels((key) => r[key as keyof typeof r])}
      />
      <Viewer
        value={undefined}
        labels={jsonLabels((key) => r[key as keyof typeof r])}
      />
    </>
  );
}
export function ValidationList({ t }: ExampleProps) {
  const { r } = copy(t);
  return (
    <>
      <List
        issues={[
          {
            code: 'REQUIRED',
            path: 'tabs[0]',
            message: r.invalidForm,
            severity: 'error',
          },
          {
            code: 'WARNING',
            path: 'flow',
            message: r.invalidValues,
            severity: 'warning',
          },
        ]}
        labels={r}
      />
      <List issues={[]} labels={r} />
    </>
  );
}
export function FormRenderer({ t }: ExampleProps) {
  const { p } = copy(t);
  const example = formDefinitionSchema.parse({
    title: t.sample,
    tabs: [
      {
        id: 'example',
        title: t.step2,
        questions: [
          {
            field: {
              type: 'TEXT_FIELD',
              techName: 'name',
              title: t.label,
              validation: ['REQUIRED'],
            },
          },
          {
            field: {
              type: 'TEXT_FIELD',
              techName: 'external',
              title: t.external,
              readOnly: true,
              defaultValue: 'MLPZ.name',
              defaultValueType: 'EXTERNAL_SYSTEM',
            },
          },
          {
            field: {
              type: 'TEXT_FIELD',
              techName: 'invalid',
              title: t.errorState,
              states: [{ type: 'SHOW', query: '(' }],
            },
          },
        ],
      },
    ],
  });
  return (
    <Renderer
      form={example}
      labels={previewLabels((key, values) =>
        p[key as keyof typeof p].replace('{name}', String(values?.name ?? '')),
      )}
    />
  );
}
export function ResultLayout({ t }: ExampleProps) {
  const { r, locale } = copy(t);
  function open(large = false) {
    const form = formDefinitionSchema.parse(tax);
    if (large)
      form.largeExample = Array.from({ length: 20000 }, (_, index) => ({
        index,
        value: 'JSON',
      }));
    putResult({
      id: large ? 'catalogue-large' : 'catalogue-tax',
      form,
      meta: {},
    });
  }
  return (
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <Layout
        as="section"
        title={r.title}
        active="json"
        navigationLabel={r.tabs}
        tabs={[
          { id: 'json', label: r.json, href: '#JsonViewer' },
          { id: 'validation', label: r.validation, href: '#ValidationList' },
          { id: 'preview', label: r.preview, href: '#FormRenderer' },
        ]}
      >
        <NextLink
          className={`${target} ${focus} inline-flex items-center text-primary underline`}
          href={`/${locale}/results/catalogue-tax/json`}
          onClick={() => open()}
        >
          {r.openExample}
        </NextLink>
        <NextLink
          className={`${target} ${focus} inline-flex items-center text-primary underline`}
          href={`/${locale}/results/catalogue-large/json`}
          onClick={() => open(true)}
        >
          {r.openLarge}
        </NextLink>
      </Layout>
    </NextIntlClientProvider>
  );
}
