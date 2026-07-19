import type { ExternalReview, ReviewsOutput, ReviewSource, SourceMetadata, SourceResult } from '../types.js';

export function sortReviews(reviews: ExternalReview[]): ExternalReview[] {
  return [...reviews].sort((left, right) => {
    const leftTime = left.createdAt ? Date.parse(left.createdAt) : Number.NEGATIVE_INFINITY;
    const rightTime = right.createdAt ? Date.parse(right.createdAt) : Number.NEGATIVE_INFINITY;
    return rightTime - leftTime || left.id.localeCompare(right.id);
  });
}

export function mergeReviews(options: {
  previous: ReviewsOutput | null;
  selectedSources: ReviewSource[];
  results: SourceResult[];
  allowEmptySource: boolean;
  now?: string;
}): ReviewsOutput {
  const previousReviews = options.previous?.reviews ?? [];
  const byResult = new Map(options.results.map((result) => [result.source, result]));
  const finalReviews: ExternalReview[] = [];
  const metadata = {} as ReviewsOutput['sources'];

  for (const source of ['yandex', '2gis'] as ReviewSource[]) {
    const old = previousReviews.filter((review) => review.source === source);
    const oldMeta = options.previous?.sources[source];
    const selected = options.selectedSources.includes(source);
    const result = byResult.get(source);

    if (!selected || !result) {
      finalReviews.push(...old);
      metadata[source] = staleMetadata(old, oldMeta, 'Source was not selected');
      continue;
    }

    if (!result.ok) {
      finalReviews.push(...old);
      metadata[source] = old.length
        ? staleMetadata(old, oldMeta, result.error ?? 'Source failed')
        : { status: 'failed', fetchedAt: null, count: 0, error: result.error ?? 'Source failed' };
      continue;
    }

    if (result.reviews.length === 0 && old.length > 0 && !options.allowEmptySource) {
      finalReviews.push(...old);
      metadata[source] = staleMetadata(old, oldMeta, 'Suspicious empty result; previous reviews preserved');
      continue;
    }

    finalReviews.push(...result.reviews);
    metadata[source] = {
      status: 'ok',
      fetchedAt: result.fetchedAt,
      count: result.reviews.length,
      error: null,
    };
  }

  const deduplicated = [...new Map(finalReviews.map((review) => [review.id, review])).values()];
  return {
    schemaVersion: 1,
    generatedAt: options.now ?? new Date().toISOString(),
    sources: metadata,
    reviews: sortReviews(deduplicated),
  };
}

function staleMetadata(reviews: ExternalReview[], previous: SourceMetadata | undefined, error: string): SourceMetadata {
  return {
    status: reviews.length ? 'stale' : 'failed',
    fetchedAt: previous?.fetchedAt ?? null,
    count: reviews.length,
    error,
  };
}
