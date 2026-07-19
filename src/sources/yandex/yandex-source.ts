import type { AppConfig } from '../../config.js';
import { logger } from '../../logger.js';
import type { SourceFetchOptions, SourceResult } from '../../types.js';
import { sleep } from '../../utils/sleep.js';
import { paginate } from '../paginate.js';
import { saveRawPage } from '../raw.js';
import type { ReviewsSource } from '../source.js';
import { YandexClient } from './yandex-client.js';
import { normalizeYandexReview } from './yandex-normalizer.js';
import type { YandexReviewRecord } from './yandex-types.js';

export class YandexReviewsSource implements ReviewsSource {
  constructor(private readonly config: AppConfig) {}

  async fetch(options: SourceFetchOptions): Promise<SourceResult> {
    const scrapedAt = new Date().toISOString();
    try {
      const client = new YandexClient(this.config);
      const result = await paginate<YandexReviewRecord>({
        first: '1',
        maxPages: this.config.maxPages,
        idOf: (item) => typeof item.reviewId === 'string' ? item.reviewId : null,
        delay: () => sleep(this.config.delayMs),
        fetchPage: async (cursor, pageNumber) => {
          const page = await client.fetchPage(Number(cursor));
          if (options.saveRaw) await saveRawPage(this.config.rawDir, 'yandex', pageNumber, page.raw);
          return { items: page.reviews, next: page.next };
        },
      });
      const reviews = result.items
        .map((item) => normalizeYandexReview(item, scrapedAt))
        .filter((item) => item !== null);
      const skipped = result.items.length - reviews.length;
      if (skipped) logger.warn(`Yandex: skipped ${skipped} malformed or rating-only record(s)`);
      return { source: 'yandex', ok: true, reviews, fetchedAt: scrapedAt, pages: result.pages, error: null };
    } catch (error) {
      return { source: 'yandex', ok: false, reviews: [], fetchedAt: null, pages: 0, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
