import { describe, expect, it, vi } from 'vitest';
import { AccessError, HttpError } from '../src/errors.js';
import { paginate } from '../src/sources/paginate.js';
import { withRetry } from '../src/utils/retry.js';

describe('pagination safety', () => {
  it('follows next cursors and stops on an empty final page', async () => {
    const fetchPage = vi.fn(async (cursor: string) => cursor === '1'
      ? { items: [{ id: 'a' }], next: '2' }
      : { items: [], next: null });
    const result = await paginate({ first: '1', maxPages: 10, idOf: (item) => item.id, fetchPage });
    expect(result).toEqual({ items: [{ id: 'a' }], pages: 2 });
  });

  it('stops on repeated cursor', async () => {
    const fetchPage = vi.fn(async () => ({ items: [{ id: 'a' }], next: '1' }));
    const result = await paginate({ first: '1', maxPages: 10, idOf: (item) => item.id, fetchPage });
    expect(result.pages).toBe(1);
  });

  it('stops when a page has no new ids', async () => {
    const fetchPage = vi.fn(async (cursor: string) => ({ items: [{ id: 'a' }], next: String(Number(cursor) + 1) }));
    const result = await paginate({ first: '1', maxPages: 10, idOf: (item) => item.id, fetchPage });
    expect(result.pages).toBe(2);
  });

  it('enforces maximum page count', async () => {
    const fetchPage = vi.fn(async (cursor: string) => ({ items: [{ id: cursor }], next: String(Number(cursor) + 1) }));
    const result = await paginate({ first: '1', maxPages: 3, idOf: (item) => item.id, fetchPage });
    expect(result.pages).toBe(3);
  });
});

describe('bounded retry', () => {
  it('retries a transient error', async () => {
    let attempts = 0;
    const result = await withRetry(async () => {
      attempts += 1;
      if (attempts === 1) throw new HttpError('temporary', 500);
      return 'ok';
    }, 2, 0);
    expect(result).toBe('ok');
    expect(attempts).toBe(2);
  });

  it('does not retry a permanent access error', async () => {
    let attempts = 0;
    await expect(withRetry(async () => {
      attempts += 1;
      throw new AccessError('forbidden');
    }, 5, 0)).rejects.toThrow('forbidden');
    expect(attempts).toBe(1);
  });
});
