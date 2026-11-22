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
export function useResult(id: string) {
  return useQueue().find((item) => item.id === id)?.result;
}
