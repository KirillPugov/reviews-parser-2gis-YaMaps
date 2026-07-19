import type { ExternalReview, ReviewsOutput, ReviewSource } from '../types.js';

function isIso(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function validateReview(review: ExternalReview, index: number): void {
  const prefix = `reviews[${index}]`;
  if (!review || typeof review !== 'object') throw new Error(`${prefix} must be an object`);
  if (review.source !== 'yandex' && review.source !== '2gis') throw new Error(`${prefix}.source is invalid`);
  if (review.id !== `${review.source}:${review.externalId}`) throw new Error(`${prefix}.id is not deterministic`);
  if (!review.externalId || typeof review.externalId !== 'string') throw new Error(`${prefix}.externalId is invalid`);
  if (!review.authorName || typeof review.authorName !== 'string') throw new Error(`${prefix}.authorName is invalid`);
  if (!review.text || typeof review.text !== 'string') throw new Error(`${prefix}.text is invalid`);
  if (review.rating !== null && (!Number.isFinite(review.rating) || review.rating < 1 || review.rating > 5)) {
    throw new Error(`${prefix}.rating is invalid`);
  }
  for (const key of ['createdAt', 'updatedAt'] as const) {
    if (review[key] !== null && !isIso(review[key])) throw new Error(`${prefix}.${key} is invalid`);
  }
  if (!isIso(review.scrapedAt)) throw new Error(`${prefix}.scrapedAt is invalid`);
  if (review.authorAvatarUrl !== null) new URL(review.authorAvatarUrl);
  if (review.reviewUrl !== null) new URL(review.reviewUrl);
  if (!Array.isArray(review.photos) || new Set(review.photos).size !== review.photos.length) {
    throw new Error(`${prefix}.photos must be a deduplicated array`);
  }
  for (const photo of review.photos) new URL(photo);
  if (review.reply) {
    if (!review.reply.text) throw new Error(`${prefix}.reply.text is invalid`);
    if (review.reply.createdAt !== null && !isIso(review.reply.createdAt)) throw new Error(`${prefix}.reply.createdAt is invalid`);
  }
}

export function validateOutput(value: unknown): asserts value is ReviewsOutput {
  const output = value as ReviewsOutput;
  if (!output || typeof output !== 'object') throw new Error('Output must be an object');
  if (output.schemaVersion !== 1) throw new Error('schemaVersion must be 1');
  if (!isIso(output.generatedAt)) throw new Error('generatedAt must be ISO 8601');
  if (!output.sources || !Array.isArray(output.reviews)) throw new Error('sources and reviews are required');
  for (const source of ['yandex', '2gis'] as ReviewSource[]) {
    const metadata = output.sources[source];
    if (!metadata || !['ok', 'stale', 'failed'].includes(metadata.status)) throw new Error(`sources.${source}.status is invalid`);
    if (metadata.fetchedAt !== null && !isIso(metadata.fetchedAt)) throw new Error(`sources.${source}.fetchedAt is invalid`);
    if (!Number.isInteger(metadata.count) || metadata.count < 0) throw new Error(`sources.${source}.count is invalid`);
    if (metadata.error !== null && typeof metadata.error !== 'string') throw new Error(`sources.${source}.error is invalid`);
  }
  const ids = new Set<string>();
  output.reviews.forEach((review, index) => {
    validateReview(review, index);
    if (ids.has(review.id)) throw new Error(`Duplicate review id: ${review.id}`);
    ids.add(review.id);
  });
}
