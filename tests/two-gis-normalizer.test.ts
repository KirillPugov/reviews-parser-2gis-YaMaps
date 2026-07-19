import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { normalizeTwoGisReview } from '../src/sources/two-gis/two-gis-normalizer.js';
import type { TwoGisReviewRecord } from '../src/sources/two-gis/two-gis-types.js';

const fixture = JSON.parse(await readFile(new URL('../fixtures/two-gis/reviews-page.json', import.meta.url), 'utf8')) as { reviews: TwoGisReviewRecord[] };
const scrapedAt = '2026-07-16T00:00:00.000Z';

describe('normalizeTwoGisReview', () => {
  it('normalizes standard fields, reply, edit date and deduplicated photos', () => {
    const review = normalizeTwoGisReview(fixture.reviews[0]!, scrapedAt);
    expect(review).toMatchObject({
      id: '2gis:dg-standard', authorName: 'Борис', rating: 5, text: 'Всё сделали в срок.',
      authorAvatarUrl: 'https://photo.example.test/avatar.jpg',
      reply: { text: 'Благодарим!', createdAt: '2025-02-03T07:00:00.000Z' },
    });
    expect(review?.photos).toEqual(['https://photo.example.test/review.jpg']);
    expect(review?.updatedAt).toBe('2025-02-02T07:00:00.000Z');
  });

  it('uses defaults and null for an invalid rating', () => {
    expect(normalizeTwoGisReview(fixture.reviews[1]!, scrapedAt)).toMatchObject({
      authorName: 'Пользователь', authorAvatarUrl: null, rating: null, reply: null,
    });
  });

  it('skips malformed and rating-only records', () => {
    expect(normalizeTwoGisReview(fixture.reviews[2]!, scrapedAt)).toBeNull();
  });
});
