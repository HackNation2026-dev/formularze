import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { messages } from '@/i18n/messages';
import { api } from '@/lib/api';
import { batchStore } from '@/features/batch';
import Page from './page';

const push = vi.fn();
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/batch',
}));

const file = (name: string) =>
  new File(['%PDF-1.7'], name, { type: 'application/pdf' });

function PageWithIntl() {
  const client = new QueryClient();
  return (
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pl" messages={messages.pl}>
        <Page />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe('trasa /batch', () => {
  beforeEach(() => {
    batchStore.clear();
    push.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('wysyła wsad jednym multipartem i otwiera wynik podglądu', async () => {
    const analyzeBatch = vi
      .spyOn(api, 'analyzeBatch')
      .mockResolvedValue({
        results: [
          {
            filename: 'f1.pdf',
            status: 200 as const,
            form: { title: 'Wynik', tabs: [], flow: { links: [] } },
            processing_time_ms: 10,
            detected_type: 'pdf',
            detected_score: 1,
            warnings: 0,
            extractor: 'StubExtractor',
          },
        ],
        ok: 1,
        failed: 0,
      });
    batchStore.addFiles([file('f1.pdf')]);
    render(<PageWithIntl />);
    fireEvent.click(screen.getByRole('button', { name: 'Analizuj wszystko' }));
    await waitFor(() =>
      expect(screen.getByText('Gotowe')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Otwórz wynik' }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        expect.stringMatching(/\/results\/[\w-]+\/preview$/),
      ),
    );
    const body = analyzeBatch.mock.calls[0][0] as File[];
    expect(body).toHaveLength(1);
  });

  it('pokazuje wiersz błędu z kodem', async () => {
    vi.spyOn(api, 'analyzeBatch').mockResolvedValue({
      results: [
        {
          filename: 'zly.txt',
          status: 415,
          error: {
            code: 'UNSUPPORTED_MEDIA_TYPE',
            message: 'Nieobsługiwany format pliku.',
            details: {},
          },
        },
      ],
      ok: 0,
      failed: 1,
    });
    batchStore.addFiles([file('zly.txt')]);
    render(<PageWithIntl />);
    fireEvent.click(screen.getByRole('button', { name: 'Analizuj wszystko' }));
    await waitFor(() =>
      expect(batchStore.getSnapshot()[0].status).toBe('error'),
    );
    expect(
      screen.getAllByText((_, element) =>
        !!element?.textContent?.includes('UNSUPPORTED_MEDIA_TYPE'),
      ).length,
    ).toBeGreaterThan(0);
  });
});
