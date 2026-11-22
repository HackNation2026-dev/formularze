import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from '@/mocks/server';
import { setMockScenario } from '@/mocks/scenarios';
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  if (typeof window !== 'undefined') localStorage.clear();
  setMockScenario('auto');
});
afterAll(() => server.close());
