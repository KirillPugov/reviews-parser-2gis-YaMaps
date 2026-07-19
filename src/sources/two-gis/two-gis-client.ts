import type { AppConfig } from '../../config.js';
import { ResponseFormatError } from '../../errors.js';
import { HttpClient } from '../../utils/fetch.js';
import { asRecord } from '../../utils/validation.js';
import type { TwoGisReviewRecord } from './two-gis-types.js';

export class TwoGisClient {
  private readonly http: HttpClient;

  constructor(private readonly config: AppConfig) {
    this.http = new HttpClient({
      timeoutMs: config.timeoutMs,
      retryCount: config.retryCount,
      retryDelayMs: Math.max(config.delayMs, 100),
      userAgent: config.userAgent,
    });
  }

  firstUrl(): string {
    const url = new URL(`https://public-api.reviews.2gis.com/3.0/branches/${this.config.twoGis.firmId}/reviews`);
    url.search = new URLSearchParams({
      limit: '50',
      rated: 'true',
      sort_by: 'date_created',
      fields: 'meta.providers,meta.branch_rating,meta.branch_reviews_count,meta.total_count',
      locale: 'ru_RU',
      key: this.config.twoGis.reviewsKey,
    }).toString();
    return url.toString();
  }

  async fetchPage(url: string): Promise<{ raw: unknown; reviews: TwoGisReviewRecord[]; next: string | null }> {
    const parsedUrl = new URL(url, 'https://public-api.reviews.2gis.com');
    if (parsedUrl.hostname !== 'public-api.reviews.2gis.com') {
      throw new ResponseFormatError('2GIS pagination URL changed to an unexpected host');
    }
    const { data } = await this.http.json(parsedUrl.toString(), {
      headers: { referer: this.config.twoGis.businessUrl },
    });
    const root = asRecord(data);
    if (!root || !Array.isArray(root.reviews)) {
      throw new ResponseFormatError('2GIS review response structure is incompatible');
    }
    const reviews = root.reviews.filter((item): item is TwoGisReviewRecord => Boolean(asRecord(item)));
    const meta = asRecord(root.meta);
    const nextLink = typeof meta?.next_link === 'string' && meta.next_link ? meta.next_link : null;
    let next = nextLink ? new URL(nextLink, parsedUrl).toString() : null;
    if (!next && reviews.length === 50) {
      const lastDate = reviews.at(-1)?.date_created;
      if (typeof lastDate === 'string' && lastDate) {
        const fallback = new URL(this.firstUrl());
        fallback.searchParams.set('offset_date', lastDate);
        next = fallback.toString();
      }
    }
    return { raw: data, reviews, next };
  }
}
