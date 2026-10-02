import { afterEach, describe, expect, it, vi } from 'vitest';

// Task 24: the API address is '/api' (same origin: the dev proxy, or the
// production reverse proxy) unless a split deployment sets VITE_API_URL.
describe('API base URL', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is '/api' by default", async () => {
    vi.stubEnv('VITE_API_URL', '');
    vi.resetModules();
    const { default: api, API_BASE_URL } = await import('../api/axios');
    expect(API_BASE_URL).toBe('/api');
    expect(api.defaults.baseURL).toBe('/api');
  });

  it('uses VITE_API_URL when the frontend is hosted apart from the backend', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.com/api');
    vi.resetModules();
    const { default: api } = await import('../api/axios');
    expect(api.defaults.baseURL).toBe('https://api.example.com/api');
  });
});
