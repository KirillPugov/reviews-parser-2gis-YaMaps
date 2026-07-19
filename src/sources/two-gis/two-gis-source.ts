import type { AppConfig } from '../../config.js';
import { logger } from '../../logger.js';
import type { SourceFetchOptions, SourceResult } from '../../types.js';
import { sleep } from '../../utils/sleep.js';
import { paginate } from '../paginate.js';
import { saveRawPage } from '../raw.js';
import type { ReviewsSource } from '../source.js';
import { TwoGisClient } from './two-gis-client.js';
import { normalizeTwoGisReview } from './two-gis-normalizer.js';
import type { TwoGisReviewRecord } from './two-gis-types.js';

export class TwoGisReviewsSource implements ReviewsSource {
  constructor(private readonly config: AppConfig) {}

  async fetch(options: SourceFetchOptions): Promise<SourceResult> {
    const scrapedAt = new Date().toISOString();
    try {
      const client = new TwoGisClient(this.config);
      const result = await paginate<TwoGisReviewRecord>({
        first: client.firstUrl(),
        maxPages: this.config.maxPages,
        idOf: (item) => typeof item.id === 'string' ? item.id : null,
        delay: () => sleep(this.config.delayMs),
        fetchPage: async (cursor, pageNumber) => {
          const page = await client.fetchPage(cursor);
          if (options.saveRaw) await saveRawPage(this.config.rawDir, '2gis', pageNumber, page.raw);
          return { items: page.reviews, next: page.next };
        },
      });
      const reviews = result.items
        .map((item) => normalizeTwoGisReview(item, scrapedAt))
        .filter((item) => item !== null);
      const skipped = result.items.length - reviews.length;
      if (skipped) logger.warn(`2GIS: skipped ${skipped} malformed or rating-only record(s)`);
      return { source: '2gis', ok: true, reviews, fetchedAt: scrapedAt, pages: result.pages, error: null };
    } catch (error) {
      return { source: '2gis', ok: false, reviews: [], fetchedAt: null, pages: 0, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
