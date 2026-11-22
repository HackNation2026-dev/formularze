import { describe, expect, it, vi } from 'vitest';

describe('mock-runtime', () => {
  it('domyślnie live: bez zmiennej w development mock jest wyłączony', async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    delete process.env.NEXT_PUBLIC_API_MODE;
    vi.stubEnv('NODE_ENV', 'development');
    const { mockEnabled } = await import('./mock-runtime');
    expect(mockEnabled).toBe(false);
  });

  it('mock włącza się tylko przy NEXT_PUBLIC_API_MODE=mock', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_API_MODE', 'mock');
    const { mockEnabled } = await import('./mock-runtime');
    expect(mockEnabled).toBe(true);
  });

  it('NEXT_PUBLIC_API_MODE=live wymusza live nawet w development', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_API_MODE', 'live');
    vi.stubEnv('NODE_ENV', 'development');
    const { mockEnabled } = await import('./mock-runtime');
    expect(mockEnabled).toBe(false);
  });
});
