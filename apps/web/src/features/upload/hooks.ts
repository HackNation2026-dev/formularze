'use client';
import { useSyncExternalStore } from 'react';
import { queueStore, type QueueItem } from './store';
const empty: QueueItem[] = [];
export function useQueue() {
  return useSyncExternalStore(
    queueStore.subscribe,
    queueStore.getSnapshot,
    () => empty,
  );
}
