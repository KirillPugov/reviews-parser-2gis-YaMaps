import type { ExternalReview } from '../../types.js';
import { toIsoDate } from '../../utils/dates.js';
import { absoluteUrl, asRecord, asString } from '../../utils/validation.js';
import type { TwoGisReviewRecord } from './two-gis-types.js';

export function normalizeTwoGisReview(raw: TwoGisReviewRecord, scrapedAt: string): ExternalReview | null {
  const externalId = asString(raw.id);
  const text = asString(raw.text);
  if (!externalId || !text) return null;
  const user = asRecord(raw.user);
  const previews = asRecord(user?.photo_preview_urls);
  const rating = typeof raw.rating === 'number' && raw.rating >= 1 && raw.rating <= 5 ? raw.rating : null;
  const answer = asRecord(raw.official_answer);
  const answerText = asString(answer?.text);
  const media = Array.isArray(raw.media) ? raw.media : [];
  const photos = [...new Set(media.flatMap((item) => {
    const record = asRecord(item);
    const previewUrls = asRecord(record?.preview_urls);
    return [record?.url, previewUrls?.url, previewUrls?.['1920x']]
      .map((url) => absoluteUrl(url))
      .filter((url): url is string => Boolean(url));
  }))];

  return {
    id: `2gis:${externalId}`,
    externalId,
    source: '2gis',
    authorName: asString(user?.name) ?? 'Пользователь',
    authorAvatarUrl: absoluteUrl(previews?.['320x'] ?? previews?.url),
    rating,
    text,
    createdAt: toIsoDate(raw.date_created),
    updatedAt: toIsoDate(raw.date_edited),
    reviewUrl: null,
    photos,
    reply: answerText ? { text: answerText, createdAt: toIsoDate(answer?.date_created) } : null,
    scrapedAt,
  };
}
