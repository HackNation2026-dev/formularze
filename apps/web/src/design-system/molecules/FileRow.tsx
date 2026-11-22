import type { ReactNode } from 'react';
import { Icon } from '../atoms/Icon';
import { ProgressBar } from '../atoms/ProgressBar';
import { StatusChip } from './StatusChip';
export type FileRowState = 'queued' | 'processing' | 'done' | 'error';
export interface FileRowProps {
  filename: string;
  state: FileRowState;
  statusLabel: string;
  progress?: number;
  progressLabel?: string;
  error?: { code?: string; status?: number; message: string };
  details?: ReactNode;
  actions?: ReactNode;
}
export function FileRow({
  filename,
  state,
  statusLabel,
  progress,
  progressLabel,
  error,
  details,
  actions,
}: FileRowProps) {
  return (
    <div
      data-state={state}
      className="grid min-w-0 gap-3 rounded-md border border-border-strong bg-surface p-4"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Icon name="file" />
        <span
          className="min-w-0 flex-1 truncate font-semibold"
          title={filename}
        >
          {filename}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <StatusChip
          tone={
            {
              queued: 'neutral',
              processing: 'info',
              done: 'success',
              error: 'danger',
            }[state] as 'neutral' | 'info' | 'success' | 'danger'
          }
        >
          {statusLabel}
        </StatusChip>
        {actions}
      </div>
      {state === 'processing' && (
        <ProgressBar value={progress} label={progressLabel ?? statusLabel} />
      )}
      {state === 'error' && error && (
        <div className="text-danger">
          <p className="break-words font-mono text-sm">
            {error.code}
            {error.status && ` · ${error.status}`}
          </p>
          <p>{error.message}</p>
        </div>
      )}
      {details}
    </div>
  );
}
