export const mockEnabled =
  process.env.NEXT_PUBLIC_API_MODE === 'mock' ||
  (!process.env.NEXT_PUBLIC_API_MODE && process.env.NODE_ENV === 'development');

declare global {
  interface Window {
    formgenMockReady?: Promise<unknown>;
  }
}
