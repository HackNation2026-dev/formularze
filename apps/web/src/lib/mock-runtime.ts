export const mockEnabled = process.env.NEXT_PUBLIC_API_MODE === 'mock';

declare global {
  interface Window {
    formgenMockReady?: Promise<unknown>;
  }
}
