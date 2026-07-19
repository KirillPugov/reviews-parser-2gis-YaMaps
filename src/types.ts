export type ReviewSource = 'yandex' | '2gis';

export interface ReviewReply {
  text: string;
  createdAt: string | null;
}

export interface ExternalReview {
  id: string;
  externalId: string;
  source: ReviewSource;
  authorName: string;
  authorAvatarUrl: string | null;
  rating: number | null;
  text: string;
  createdAt: string | null;
  updatedAt: string | null;
  reviewUrl: string | null;
  photos: string[];
  reply: ReviewReply | null;
  scrapedAt: string;
}

export type SourceStatus = 'ok' | 'stale' | 'failed';

export interface SourceMetadata {
  status: SourceStatus;
  fetchedAt: string | null;
  count: number;
  error: string | null;
}

export interface ReviewsOutput {
  schemaVersion: 1;
  generatedAt: string;
  sources: {
    yandex: SourceMetadata;
    '2gis': SourceMetadata;
  };
  reviews: ExternalReview[];
}

export interface SourceResult {
  source: ReviewSource;
  ok: boolean;
  reviews: ExternalReview[];
  fetchedAt: string | null;
  pages: number;
  error: string | null;
}

export interface SourceFetchOptions {
  saveRaw: boolean;
}
