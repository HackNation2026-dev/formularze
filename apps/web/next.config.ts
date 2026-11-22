import createNextIntlPlugin from 'next-intl/plugin';
import { fileURLToPath } from 'node:url';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
export default withNextIntl({
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  turbopack: { root: fileURLToPath(new URL('.', import.meta.url)) },
});
