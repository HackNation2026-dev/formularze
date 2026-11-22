// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw/http';
import { server } from '@/mocks/server';
import { ApiClient } from './client';
import { subscribeActivity } from './activity';

const api = new ApiClient('http://localhost');

describe('dziennik aktywności API', () => {
  it('emituje zdarzenie dla każdego żądania: metoda, ścieżka, status, czas', async () => {
    server.use(
      http.get('*/health', () => HttpResponse.json({ status: 'ok', version: '0.0.0-test' })),
    );
    const listener = vi.fn();
    const unsubscribe = subscribeActivity(listener);
    try {
      await api.health();
      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0];
      expect(event.method).toBe('GET');
      expect(event.path).toBe('/health');
      expect(event.status).toBe(200);
      expect(typeof event.ms).toBe('number');
      expect(event.ms).toBeGreaterThanOrEqual(0);
    } finally {
      unsubscribe();
    }
  });

  it('odpisanie zatrzymuje nasłuch', async () => {
    server.use(
      http.get('*/health', () => HttpResponse.json({ status: 'ok', version: '0.0.0-test' })),
    );
    const listener = vi.fn();
    const unsubscribe = subscribeActivity(listener);
    unsubscribe();
    await api.health();
    expect(listener).not.toHaveBeenCalled();
  });

  it('błąd HTTP także zostaje zarejestrowany ze statusem', async () => {
    server.use(
      http.get('*/health', () => HttpResponse.json(null, { status: 503 })),
    );
    const listener = vi.fn();
    const unsubscribe = subscribeActivity(listener);
    try {
      await expect(api.health()).rejects.toBeTruthy();
      expect(listener.mock.calls[0][0].status).toBe(503);
    } finally {
      unsubscribe();
    }
  });
});

