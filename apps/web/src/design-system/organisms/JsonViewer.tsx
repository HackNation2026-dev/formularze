'use client';
import { useState } from 'react';
import { Button } from '../atoms/Button';
import { EmptyState } from '../molecules/EmptyState';
export interface JsonViewerLabels {
  empty: string;
  copy: string;
  copied: string;
  copyError: string;
  download: string;
  more: string;
  expand: string;
  collapse: string;
}
export interface JsonViewerProps {
  value: unknown;
  labels: JsonViewerLabels;
  filename?: string;
}
const punctuation = 'text-muted';
function Primitive({ value }: { value: unknown }) {
  const color =
    value === null
      ? 'text-danger'
      : typeof value === 'string'
        ? 'text-success'
        : typeof value === 'number'
          ? 'text-info'
          : 'text-warning';
  return <span className={color}>{JSON.stringify(value)}</span>;
}
function Node({
  value,
  name,
  labels,
  depth = 0,
  comma = false,
}: {
  value: unknown;
  name?: string;
  labels: JsonViewerLabels;
  depth?: number;
  comma?: boolean;
}) {
  const [open, setOpen] = useState(depth < 1);
  const [limit, setLimit] = useState(40);
  const composite = value !== null && typeof value === 'object';
  const prefix =
    name === undefined ? null : (
      <>
        <span className="text-primary">{JSON.stringify(name)}</span>
        <span className={punctuation}>: </span>
      </>
    );
  if (!composite)
    return (
      <div>
        {prefix}
        <Primitive value={value} />
        {comma && <span className={punctuation}>,</span>}
      </div>
    );
  const entries = Object.entries(value);
  const array = Array.isArray(value);
  return (
    <div>
      {prefix}
      <Button
        variant="ghost"
        className="justify-start! border-0! px-0! py-0! align-middle font-mono font-normal!"
        aria-expanded={open}
        aria-label={`${open ? labels.collapse : labels.expand} ${name ?? ''}`}
        onClick={() => setOpen(!open)}
      >
        <span className={punctuation}>
          {array ? '[' : '{'}
          {!open && ` … ${entries.length} ${array ? ']' : '}'}`}
        </span>
      </Button>
      {!open && comma && <span className={punctuation}>,</span>}
      {open && (
        <>
          <div className="border-l border-border pl-4">
            {entries.slice(0, limit).map(([key, child], index) => (
              <div key={key}>
                <Node
                  value={child}
                  name={array ? undefined : key}
                  labels={labels}
                  depth={depth + 1}
                  comma={index < entries.length - 1}
                />
              </div>
            ))}
            {limit < entries.length && (
              <Button variant="ghost" onClick={() => setLimit(limit + 40)}>
                {labels.more}
              </Button>
            )}
          </div>
          <span className={punctuation}>
            {array ? ']' : '}'}
            {comma ? ',' : ''}
          </span>
        </>
      )}
    </div>
  );
}
export function JsonViewer({
  value,
  labels,
  filename = 'konfiguracja.json',
}: JsonViewerProps) {
  const [status, setStatus] = useState('');
  if (value === undefined || value === null)
    return <EmptyState title={labels.empty} />;
  const serialized = JSON.stringify(value, null, 2);
  async function copy() {
    try {
      await navigator.clipboard.writeText(serialized);
      setStatus(labels.copied);
    } catch {
      setStatus(labels.copyError);
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([serialized], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return (
    <section className="grid min-w-0 gap-4">
      <div className="flex flex-wrap gap-3">
        <Button onClick={copy}>{labels.copy}</Button>
        <Button variant="secondary" onClick={download}>
          {labels.download}
        </Button>
        <span role="status">{status}</span>
      </div>
      <div
        role="region"
        aria-label="JSON"
        tabIndex={0}
        className="max-h-96 min-w-0 max-w-full overflow-auto rounded-md border border-border bg-surface p-4 font-mono text-sm whitespace-pre"
      >
        <Node value={value} labels={labels} />
      </div>
    </section>
  );
}
