'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
export function useSystemStatus() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => api.health(),
    retry: 2,
    retryDelay: 500,
    refetchInterval: 30000,
  });
  const ready = useQuery({
    queryKey: ['ready'],
    queryFn: () => api.ready(),
    retry: 2,
    retryDelay: 500,
    refetchInterval: 30000,
  });
  const status = health.isError
    ? 'offline'
    : ready.isError
      ? 'unavailable'
      : health.isPending || ready.isPending
        ? 'loading'
        : ready.data.status;
  return {
    status,
    health,
    ready,
    retry: () => {
      void health.refetch();
      void ready.refetch();
    },
  };
}
