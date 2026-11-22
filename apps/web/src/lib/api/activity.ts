export interface ApiActivityEvent {
  path: string;
  method: string;
  status: number;
  ms: number;
}

const listeners = new Set<(event: ApiActivityEvent) => void>();
const RECENT_LIMIT = 50;
let snapshot: ApiActivityEvent[] = [];

export function subscribeActivity(
  listener: (event: ApiActivityEvent) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function recentActivity(): ApiActivityEvent[] {
  return snapshot;
}

export function recordActivity(event: ApiActivityEvent): void {
  snapshot = [...snapshot, event].slice(-RECENT_LIMIT);
  for (const listener of listeners) listener(event);
}

export function clearActivity(): void {
  snapshot = [];
}
