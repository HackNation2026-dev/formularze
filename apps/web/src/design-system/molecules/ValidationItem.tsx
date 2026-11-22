import { Callout } from './Callout';
export interface ValidationItemProps {
  severity: 'error' | 'warning';
  message: string;
  path?: string;
  code?: string;
}
export function ValidationItem({
  severity,
  message,
  path,
  code,
}: ValidationItemProps) {
  return (
    <Callout tone={severity === 'error' ? 'danger' : 'warning'} title={message}>
      {path && <p className="break-words font-mono text-sm">{path}</p>}
      {code && <p className="font-mono text-sm">{code}</p>}
    </Callout>
  );
}
