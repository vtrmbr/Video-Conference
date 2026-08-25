import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchHealth } from '../src/lib/api/client.js';

describe('api client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a useful error when the API route responds with HTML', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<!doctype html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
      ),
    );

    await expect(fetchHealth()).rejects.toMatchObject({
      code: 'NON_JSON_RESPONSE',
      status: 200,
    });
  });
});
