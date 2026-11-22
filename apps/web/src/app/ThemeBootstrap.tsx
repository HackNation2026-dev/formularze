'use client';
import { useSyncExternalStore } from 'react';
import { themeScript } from '@/lib/theme';
const subscribe = () => () => {};
// Skrypt jest potrzebny w HTML pierwszego żądania. Przy zmianie języka
// motyw jest już ustawiony; React nie powinien tworzyć kolejnego skryptu.
export function ThemeBootstrap() {
  const initialDocument = useSyncExternalStore(
    subscribe,
    () => false,
    () => true,
  );
  return initialDocument ? (
    <script dangerouslySetInnerHTML={{ __html: themeScript }} />
  ) : null;
}
