'use client';
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { FileRow, type FileRowProps } from '../molecules/FileRow';
const features = tableFeatures({});
export interface FileQueueRow extends FileRowProps {
  id: string;
}
const helper = createColumnHelper<typeof features, FileQueueRow>();
const columns = helper.columns([helper.display({ id: 'file' })]);
export interface FileQueueProps {
  label: string;
  rows: FileQueueRow[];
}
export function FileQueue({ label, rows }: FileQueueProps) {
  const table = useTable({
    features,
    columns,
    data: rows,
    getRowId: (row) => row.id,
  });
  return (
    <div
      role="region"
      aria-label={label}
      aria-live="polite"
      aria-relevant="additions text"
      className="grid min-w-0 gap-3"
    >
      {table.getRowModel().rows.map((row) => (
        <FileRow key={row.id} {...row.original} />
      ))}
    </div>
  );
}
