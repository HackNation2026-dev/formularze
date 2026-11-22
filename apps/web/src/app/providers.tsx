'use client';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { applyTheme, THEME_KEY, type Theme } from '@/lib/theme';
import { mockEnabled } from '@/lib/mock-runtime';

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({ theme: 'System', setTheme: () => {} });
export const useTheme = () => useContext(ThemeContext);
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  const [ready, setReady] = useState(!mockEnabled);
  const [startupError, setStartupError] = useState<Error | null>(null);
  const [theme, updateTheme] = useState<Theme>('System');
  const t = useTranslations('common');
  useEffect(() => {
    let active = true;
    if (mockEnabled) {
      const mockStart =
        window.formgenMockReady ??
        Promise.reject(new Error('MSW_NOT_INITIALIZED'));
      void mockStart.then(
        () => {
          if (active) setReady(true);
        },
        (reason) => {
          if (active)
            setStartupError(
              reason instanceof Error ? reason : new Error('MSW_START_FAILED'),
            );
        },
      );
    }
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const readTheme = () => {
      let value: string | null = null;
      try {
        value = localStorage.getItem(THEME_KEY);
      } catch {
        /* Brak dostępu do preferencji. */
      }
      const current = value === 'Light' || value === 'Dark' ? value : 'System';
      updateTheme(current);
      applyTheme(current);
    };
    readTheme();
    const media = matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', readTheme);
    window.addEventListener('storage', readTheme);
    return () => {
      media.removeEventListener('change', readTheme);
      window.removeEventListener('storage', readTheme);
    };
  }, []);
  function setTheme(value: Theme) {
    try {
      localStorage.setItem(THEME_KEY, value);
    } catch {
      /* Motyw działa bez zapisu. */
    }
    updateTheme(value);
    applyTheme(value);
  }
  if (startupError) throw startupError;
  return (
    <QueryClientProvider client={client}>
      <ThemeContext.Provider value={{ theme, setTheme }}>
        {ready ? children : <p role="status">{t('loading')}</p>}
      </ThemeContext.Provider>
    </QueryClientProvider>
  );
}
