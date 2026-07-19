import { describe, expect, it } from 'vitest';
import { mergeReviews } from '../src/storage/merge-reviews.js';
import type { ExternalReview, ReviewsOutput, ReviewSource, SourceResult } from '../src/types.js';

const now = '2026-07-16T00:00:00.000Z';
function review(source: ReviewSource, externalId: string, createdAt = now): ExternalReview {
  return { id: `${source}:${externalId}`, externalId, source, authorName: 'Автор', authorAvatarUrl: null, rating: 5, text: 'Текст', createdAt, updatedAt: null, reviewUrl: null, photos: [], reply: null, scrapedAt: now };
}
function previous(reviews: ExternalReview[]): ReviewsOutput {
  return { schemaVersion: 1, generatedAt: now, sources: {
    yandex: { status: 'ok', fetchedAt: now, count: reviews.filter((r) => r.source === 'yandex').length, error: null },
    '2gis': { status: 'ok', fetchedAt: now, count: reviews.filter((r) => r.source === '2gis').length, error: null },
  }, reviews };
}
function result(source: ReviewSource, ok: boolean, reviews: ExternalReview[]): SourceResult {
  return { source, ok, reviews, fetchedAt: ok ? now : null, pages: ok ? 1 : 0, error: ok ? null : 'failure' };
}

describe('mergeReviews', () => {
  it('replaces a successful source and preserves a failed source', () => {
    const output = mergeReviews({ previous: previous([review('yandex', 'old'), review('2gis', 'old')]), selectedSources: ['yandex', '2gis'], results: [result('yandex', true, [review('yandex', 'new')]), result('2gis', false, [])], allowEmptySource: false, now });
    expect(output.reviews.map((r) => r.id)).toEqual(['2gis:old', 'yandex:new']);
    expect(output.sources['2gis'].status).toBe('stale');
  });

  it('protects against a suspicious empty result', () => {
    const output = mergeReviews({ previous: previous([review('yandex', 'old')]), selectedSources: ['yandex'], results: [result('yandex', true, [])], allowEmptySource: false, now });
    expect(output.reviews).toHaveLength(1);
    expect(output.sources.yandex.status).toBe('stale');
  });

  it('allows an explicitly accepted empty replacement', () => {
    const output = mergeReviews({ previous: previous([review('yandex', 'old')]), selectedSources: ['yandex'], results: [result('yandex', true, [])], allowEmptySource: true, now });
    expect(output.reviews).toHaveLength(0);
    expect(output.sources.yandex.status).toBe('ok');
  });

  it('does not collide equal external ids across sources and sorts deterministically', () => {
    const output = mergeReviews({ previous: null, selectedSources: ['yandex', '2gis'], results: [result('yandex', true, [review('yandex', 'same')]), result('2gis', true, [review('2gis', 'same')])], allowEmptySource: false, now });
    expect(output.reviews.map((r) => r.id)).toEqual(['2gis:same', 'yandex:same']);
  });
});
