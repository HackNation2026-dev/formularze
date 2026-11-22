import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearActivity, recordActivity } from '@/lib/api/activity';
import { ApiActivityFeed } from './ApiActivityFeed';

const labels = { title: 'Aktywność API', empty: 'Brak wywołań API' };

describe('ApiActivityFeed', () => {
  beforeEach(() => {
    clearActivity();
  });
  afterEach(() => {
    cleanup();
  });

  it('pokazuje ostatnie wywołania API z metodą, ścieżką, statusem i czasem', () => {
    recordActivity({
      path: '/api/v1/forms/analyze',
      method: 'POST',
      status: 200,
      ms: 5123,
    });
    recordActivity({ path: '/api/v1/formats', method: 'GET', status: 200, ms: 21 });
    render(<ApiActivityFeed labels={labels} />);
    const log = screen.getByRole('log');
    expect(log).toHaveAttribute('aria-live', 'polite');
    expect(log.textContent).toContain('/api/v1/forms/analyze');
    expect(log.textContent).toContain('POST');
    expect(log.textContent).toContain('/api/v1/formats');
    expect(log.textContent).toContain('21');
  });

  it('pusty dziennik nie ma wierszy żądań', () => {
    render(<ApiActivityFeed labels={labels} />);
    expect(screen.queryByText('POST')).toBeNull();
    expect(screen.queryByRole('log')).toBeNull();
  });
});
