'use client';
import { FileRow } from '@/design-system/molecules/FileRow';
import { Example, type ExampleProps } from './shared';

export default function FileRowCatalogue({ t }: ExampleProps) {
  return (
    <>
      {(['queued', 'processing', 'done', 'error'] as const).map((state) => (
        <Example
          key={state}
          label={state === 'error' ? t.errorState : t[state]}
        >
          <FileRow
            filename={t.file}
            state={state}
            statusLabel={state === 'error' ? t.errorState : t[state]}
            progress={45}
            progressLabel={t.progress}
            error={
              state === 'error'
                ? {
                    code: 'UNSUPPORTED_MEDIA_TYPE',
                    status: 415,
                    message: t.fileError,
                  }
                : undefined
            }
          />
        </Example>
      ))}
    </>
  );
}
