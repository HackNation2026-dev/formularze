'use client';
import { useMemo, useState } from 'react';
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import type { ValidationResult } from '@/lib/api/schemas';
import { Button } from '../atoms/Button';
import { TextInput } from '../atoms/TextInput';
import { Badge } from '../atoms/Badge';
import { EmptyState } from '../molecules/EmptyState';
export type ValidationLabels = Record<
  | 'code'
  | 'path'
  | 'message'
  | 'severity'
  | 'filter'
  | 'error'
  | 'warning'
  | 'noIssues'
  | 'noMatches',
  string
>;
type Issue = ValidationResult['errors'][number];
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, Issue>();
const keys = ['code', 'path', 'message', 'severity'] as const;
export function ValidationList({
  issues,
  labels,
}: {
  issues: Issue[];
  labels: ValidationLabels;
}) {
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<{
    key: (typeof keys)[number];
    desc: boolean;
  }>({ key: 'severity', desc: false });
  const columns = useMemo(
    () =>
      helper.columns(
        keys.map((key) => helper.accessor(key, { header: labels[key] })),
      ),
    [labels],
  );
  const data = useMemo(
    () =>
      issues
        .filter((issue) =>
          Object.values(issue).some((value) =>
            value.toLocaleLowerCase().includes(filter.toLocaleLowerCase()),
          ),
        )
        .sort(
          (a, b) =>
            a[sort.key].localeCompare(b[sort.key]) * (sort.desc ? -1 : 1),
        ),
    [issues, filter, sort],
  );
  const table = useTable({ features, columns, data });
  if (!issues.length) return <EmptyState title={labels.noIssues} />;
  return (
    <section className="grid min-w-0 gap-4">
      <TextInput
        aria-label={labels.filter}
        placeholder={labels.filter}
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />
      <div className="overflow-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{labels.filter}</caption>
          <thead>
            <tr>
              {keys.map((key) => (
                <th
                  scope="col"
                  key={key}
                  aria-sort={
                    sort.key === key
                      ? sort.desc
                        ? 'descending'
                        : 'ascending'
                      : 'none'
                  }
                  className="border-b border-border p-2"
                >
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setSort({ key, desc: sort.key === key && !sort.desc })
                    }
                  >
                    {labels[key]}
                  </Button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getAllCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="max-w-sm break-words border-b border-border p-2"
                  >
                    {cell.column.id === 'severity' ? (
                      <Badge
                        tone={
                          row.original.severity === 'error'
                            ? 'danger'
                            : 'warning'
                        }
                      >
                        {labels[row.original.severity]}
                      </Badge>
                    ) : (
                      <table.FlexRender cell={cell} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.length && <EmptyState title={labels.noMatches} />}
    </section>
  );
}
