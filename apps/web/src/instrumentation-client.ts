import { mockEnabled } from './lib/mock-runtime';

// Ten moduł jest kompilowany wyłącznie dla przeglądarki, przed hydratacją.
if (mockEnabled) {
  window.formgenMockReady = import('./mocks/browser').then(({ worker }) =>
    worker.start({ onUnhandledFrame: 'bypass' }),
  );
  // Provider wyświetli błąd inicjalizacji w granicy błędów Reacta.
  void window.formgenMockReady.catch(() => {});
}
