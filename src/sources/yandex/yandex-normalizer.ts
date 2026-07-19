import type { ExternalReview } from '../../types.js';
import { toIsoDate } from '../../utils/dates.js';
import { absoluteUrl, asRecord, asString } from '../../utils/validation.js';
import type { YandexReviewRecord } from './yandex-types.js';

export function normalizeYandexReview(raw: YandexReviewRecord, scrapedAt: string): ExternalReview | null {
  const externalId = asString(raw.reviewId);
  const text = asString(raw.text);
  if (!externalId || !text) return null;

  const author = asRecord(raw.author);
  const ratingValue = typeof raw.rating === 'number' && raw.rating >= 1 && raw.rating <= 5
    ? raw.rating
    : null;
  const avatar = absoluteUrl(author?.avatarUrl, { '{size}': 'islands-200' });
  const photoRecords = Array.isArray(raw.photos) ? raw.photos : [];
  const photos = [...new Set(photoRecords
    .map((photo) => absoluteUrl(asRecord(photo)?.urlTemplate, { '{size}': 'XXXL' }))
    .filter((url): url is string => Boolean(url)))];
  const comment = asRecord(raw.businessComment);
  const replyText = asString(comment?.text);
  const createdAt = toIsoDate(raw.createdTime ?? raw.updatedTime);
  const explicitCreatedAt = toIsoDate(raw.createdTime);
  const updatedAt = explicitCreatedAt ? toIsoDate(raw.updatedTime) : null;

  return {
    id: `yandex:${externalId}`,
    externalId,
    source: 'yandex',
    authorName: asString(author?.name) ?? 'Пользователь',
    authorAvatarUrl: avatar,
    rating: ratingValue,
    text,
    createdAt,
    updatedAt,
    reviewUrl: null,
    photos,
    reply: replyText ? { text: replyText, createdAt: toIsoDate(comment?.updatedTime) } : null,
    scrapedAt,
  };
}
