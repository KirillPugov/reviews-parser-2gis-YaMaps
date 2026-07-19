import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { normalizeYandexReview } from '../src/sources/yandex/yandex-normalizer.js';
import type { YandexReviewRecord } from '../src/sources/yandex/yandex-types.js';

const fixture = JSON.parse(await readFile(new URL('../fixtures/yandex/reviews-page.json', import.meta.url), 'utf8')) as { data: { reviews: YandexReviewRecord[] } };
const scrapedAt = '2026-07-16T00:00:00.000Z';

describe('normalizeYandexReview', () => {
  it('normalizes Russian text, avatar, reply, photos and deterministic id', () => {
    const review = normalizeYandexReview(fixture.data.reviews[0]!, scrapedAt);
    expect(review).toMatchObject({
      id: 'yandex:ya-standard', externalId: 'ya-standard', authorName: 'Анна',
      rating: 5, text: 'Отличная работа, спасибо!', source: 'yandex',
      authorAvatarUrl: 'https://avatars.example.test/a/islands-200',
      reply: { text: 'Спасибо за отзыв!', createdAt: '2025-01-11T12:00:00.000Z' },
    });
    expect(review?.photos).toEqual(['https://avatars.example.test/p/XXXL']);
    expect(review?.updatedAt).toBeNull();
  });

  it('uses defaults and null for an invalid rating, and keeps edit date when creation is explicit', () => {
    const review = normalizeYandexReview(fixture.data.reviews[1]!, scrapedAt);
    expect(review).toMatchObject({ authorName: 'Пользователь', authorAvatarUrl: null, rating: null, reply: null });
    expect(review?.createdAt).toBe('2024-12-01T10:00:00.000Z');
    expect(review?.updatedAt).toBe('2024-12-02T10:00:00.000Z');
  });

  it('skips malformed and rating-only records', () => {
    expect(normalizeYandexReview(fixture.data.reviews[2]!, scrapedAt)).toBeNull();
  });
});
