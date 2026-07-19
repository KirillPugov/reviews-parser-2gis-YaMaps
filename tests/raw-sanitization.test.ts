import { describe, expect, it } from 'vitest';
import { sanitizeRaw } from '../src/sources/raw.js';

describe('raw response sanitization', () => {
  it('removes session and user identifiers while preserving review ids', () => {
    const sanitized = sanitizeRaw({
      csrfToken: 'secret',
      reviews: [{ id: 'review-1', user: { id: 'user-1', public_id: 'public-1', name: 'Автор' } }],
    });
    expect(sanitized).toEqual({ reviews: [{ id: 'review-1', user: { name: 'Автор' } }] });
  });
});
