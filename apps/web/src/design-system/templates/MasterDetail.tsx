import type { ReactNode } from 'react';
export function MasterDetail({
  master,
  detail,
}: {
  master: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div
      className={`grid min-w-0 items-start gap-4 ${detail ? 'md:grid-cols-2' : ''}`}
    >
      <div className="grid min-w-0 gap-4">{master}</div>
      {detail}
    </div>
  );
}
