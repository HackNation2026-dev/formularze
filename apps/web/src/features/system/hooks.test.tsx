import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { server } from '@/mocks/server';
import { useSystemStatus } from './hooks';
afterEach(cleanup);
function wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>; }
it.each(['ok', 'degraded', 'unavailable'] as const)('mapuje gotowość %s, w tym 503', async (status) => {
  server.use(http.get('*/ready', () => HttpResponse.json({ status, extractor: 'Stub', llm: 'local', ocr: 'local' }, { status: status === 'unavailable' ? 503 : 200 })));
  const { result } = renderHook(useSystemStatus, { wrapper });
  expect(result.current.status).toBe('loading'); await waitFor(() => expect(result.current.status).toBe(status));
});
it('ponawia health i pokazuje brak API dopiero po nieudanych próbach', async () => {
  let calls = 0;
  server.use(http.get('*/health', () => { calls++; return HttpResponse.error(); }));
  const { result } = renderHook(useSystemStatus, { wrapper });
  await waitFor(() => expect(result.current.status).toBe('offline'), { timeout: 4000 }); expect(calls).toBe(3);
});
it('ponawia gotowość, po czym pozwala odzyskać status', async () => {
  let calls = 0;
  server.use(http.get('*/ready', () => { calls++; return calls < 3 ? HttpResponse.error() : HttpResponse.json({ status: 'degraded', extractor: 'HeuristicExtractor', llm: 'local', ocr: 'local' }); }));
  const { result } = renderHook(useSystemStatus, { wrapper });
  await waitFor(() => expect(result.current.status).toBe('degraded'), { timeout: 4000 }); expect(calls).toBe(3);
});
