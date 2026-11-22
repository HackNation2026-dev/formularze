import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { messages } from '@/i18n/messages';
import { Providers } from '../providers';
import { ThemeBootstrap } from '../ThemeBootstrap';
import '@/styles/globals.css';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <ThemeBootstrap />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages[locale]}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
