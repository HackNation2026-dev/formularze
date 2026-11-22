'use client';
import { useState } from 'react';
import { Toast } from '@/design-system/molecules/Toast';
import { Example, type ExampleProps } from './shared';

export default function ToastCatalogue({ t }: ExampleProps) {
  const [dismissed, setDismissed] = useState(false);
  return (
    <>
      {(['success', 'error', 'info'] as const).map((tone) => (
        <Example key={tone} label={tone === 'error' ? t.errorState : t[tone]}>
          <Toast tone={tone}>{t.sample}</Toast>
        </Example>
      ))}
      <Example label={t.close}>
        {dismissed ? (
          <p role="status">{t.dismissed}</p>
        ) : (
          <Toast onDismiss={() => setDismissed(true)} dismissLabel={t.close}>
            {t.sample}
          </Toast>
        )}
      </Example>
    </>
  );
}
