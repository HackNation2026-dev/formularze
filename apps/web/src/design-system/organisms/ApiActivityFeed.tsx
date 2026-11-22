'use client';
import { useSyncExternalStore } from 'react';
import { recentActivity, subscribeActivity } from '@/lib/api/activity';
import { Text } from '../atoms/Text';
import { Badge } from '../atoms/Badge';
import { EmptyState } from '../molecules/EmptyState';

export type ApiActivityLabels = {
  title: string;
  empty: string;
};

export function ApiActivityFeed({
  labels,
}: {
  labels: ApiActivityLabels;
}) {
  const events = useSyncExternalStore(
    subscribeActivity,
    recentActivity,
    () => [],
  );
  if (events.length === 0) {
    return <EmptyState title={labels.empty} />;
  }
  return (
    <section aria-label={labels.title}>
      <Text as="h3" variant="heading">
        {labels.title}
      </Text>
      <ul role="log" aria-live="polite" className="grid gap-1 text-sm">
        {[...events].reverse().map((event, index) => (
          <li
            key={`${event.path}-${index}`}
            className="flex flex-wrap items-center gap-2"
          >
            <Badge
              tone={event.status < 400 && event.status > 0 ? 'success' : 'danger'}
            >
              {event.method}
            </Badge>
            <Text className="break-all">{event.path}</Text>
            <Text muted>
              {event.status} · {Math.round(event.ms)} ms
            </Text>
          </li>
        ))}
      </ul>
    </section>
  );
}
