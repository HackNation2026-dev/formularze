const api = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:8001';

// Limity undici (headers/body 300 s) blokowane sygnałem 30 min: analiza LLM trwa
// po minuty, batch jeszcze dłużej; rewrite dev proxy urywa po 30 s, dlatego /api/*
// idzie przez ten handler (ten sam origin — backend nie ma CORS).
export const dynamic = 'force-dynamic';
export const maxDuration = 1800;

async function proxy(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');
  try {
    const response = await fetch(`${api}${url.pathname}${url.search}`, {
      method: request.method,
      headers,
      body: request.body,
      // @ts-expect-error duplex jest wymagany dla strumieniowego ciała w Node fetch
      duplex: 'half',
      signal: AbortSignal.timeout(1_800_000),
    });
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (cause) {
    return Response.json(
      {
        error: {
          code: 'NETWORK_ERROR',
          message: cause instanceof Error ? cause.message : 'NETWORK_ERROR',
          details: {},
        },
      },
      { status: 503 },
    );
  }
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
  proxy as HEAD,
  proxy as OPTIONS,
};
