import { AccessError, ResponseFormatError } from '../../errors.js';
import type { AppConfig } from '../../config.js';
import { HttpClient } from '../../utils/fetch.js';
import { asRecord, asString } from '../../utils/validation.js';
import type { YandexReviewRecord } from './yandex-types.js';

interface YandexSession {
  csrfToken: string;
  sessionId: string;
  reqId: string;
  cookie: string;
}

export class YandexClient {
  private readonly http: HttpClient;
  private session: YandexSession | null = null;

  constructor(private readonly config: AppConfig) {
    this.http = new HttpClient({
      timeoutMs: config.timeoutMs,
      retryCount: config.retryCount,
      retryDelayMs: Math.max(config.delayMs, 100),
      userAgent: config.userAgent,
    });
  }

  private async createSession(): Promise<YandexSession> {
    const response = await this.http.request(this.config.yandex.businessUrl, {
      headers: { accept: 'text/html', 'accept-language': 'ru-RU,ru;q=0.9' },
    });
    const html = await response.text();
    if (/showcaptcha|captcha__|вы не робот|are you a robot/i.test(html)) {
      throw new AccessError('Yandex returned a CAPTCHA or challenge page');
    }
    const csrfToken = html.match(/"csrfToken":"([^"]+)"/)?.[1];
    const sessionId = html.match(/"sessionId":"([^"]+)"/)?.[1];
    const reqId = response.headers.get('x-yandex-req-id') ?? sessionId;
    const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
    const cookie = getSetCookie
      ? getSetCookie.call(response.headers).map((item) => item.split(';', 1)[0]).join('; ')
      : '';
    if (!csrfToken || !sessionId || !reqId) {
      throw new ResponseFormatError('Yandex session fields were not found in the public business page');
    }
    return { csrfToken, sessionId, reqId, cookie };
  }

  async fetchPage(page: number): Promise<{ raw: unknown; reviews: YandexReviewRecord[]; next: string | null }> {
    this.session ??= await this.createSession();
    const params = new URLSearchParams({
      ajax: '1',
      businessId: this.config.yandex.businessId,
      csrfToken: this.session.csrfToken,
      locale: 'ru_RU',
      page: String(page),
      pageSize: '50',
      ranking: 'by_time',
      reqId: this.session.reqId,
      sessionId: this.session.sessionId,
    });
    const query = params.toString();
    params.set('s', String(yandexQueryHash(query)));
    const endpoint = new URL('/maps/api/business/fetchReviews', this.config.yandex.businessUrl);
    endpoint.search = params.toString();
    const { data } = await this.http.json(endpoint.toString(), {
      headers: {
        referer: this.config.yandex.businessUrl,
        'accept-language': 'ru-RU,ru;q=0.9',
        ...(this.session.cookie ? { cookie: this.session.cookie } : {}),
      },
    });
    const root = asRecord(data);
    const apiError = asRecord(root?.error);
    if (apiError) throw new ResponseFormatError(`Yandex API error: ${asString(apiError.message) ?? 'unknown error'}`);
    const payload = asRecord(root?.data);
    if (!payload || !Array.isArray(payload.reviews)) {
      throw new ResponseFormatError('Yandex review response structure is incompatible');
    }
    const reviews = payload.reviews.filter((item): item is YandexReviewRecord => Boolean(asRecord(item)));
    return { raw: data, reviews, next: reviews.length === 0 ? null : String(page + 1) };
  }
}

export function yandexQueryHash(query: string): number {
  let hash = 5381;
  for (let index = 0; index < query.length; index += 1) {
    hash = ((hash * 33) ^ query.charCodeAt(index)) >>> 0;
  }
  return hash;
}
