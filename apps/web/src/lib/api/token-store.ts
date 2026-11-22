const KEY = 'formgen.token';
const listeners = new Set<() => void>();
export const tokenStore = {
  get: () => {
    try {
      return typeof window === 'undefined' ? null : localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set: (token: string | null) => {
    try {
      if (token) localStorage.setItem(KEY, token);
      else localStorage.removeItem(KEY);
    } catch {
      /* Niedostępny magazyn przeglądarki. */
    }
    listeners.forEach((listener) => listener());
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
