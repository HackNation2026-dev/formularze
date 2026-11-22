import createNextIntlPlugin from 'next-intl/plugin';
import { fileURLToPath } from 'node:url';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
export default withNextIntl({
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  allowedDevOrigins: ['127.0.0.1'],
  images: { unoptimized: true },
  turbopack: { root: fileURLToPath(new URL('.', import.meta.url)) },
  // Proxy do API FastAPI (ten sam origin — backend nie ma CORSMiddleware).
  // Zmiana wyłącznie frontendowa: cel wskazuje API_INTERNAL_URL w runtime.
  async rewrites() {
    const api = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:8001';
    return [
      { source: '/health', destination: `${api}/health` },
      { source: '/ready', destination: `${api}/ready` },
      { source: '/api/:path*', destination: `${api}/api/:path*` },
    ];
  },
});

