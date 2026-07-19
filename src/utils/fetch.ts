import { AccessError, HttpError, ResponseFormatError } from '../errors.js';
import { withRetry } from './retry.js';

export interface HttpClientOptions {
  timeoutMs: number;
  retryCount: number;
  retryDelayMs: number;
  userAgent: string;
}

export class HttpClient {
  constructor(private readonly options: HttpClientOptions) {}

  async request(url: string, init: RequestInit = {}): Promise<Response> {
    return withRetry(async () => {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(this.options.timeoutMs),
        headers: {
          'user-agent': this.options.userAgent,
          accept: 'application/json, text/html;q=0.9, */*;q=0.8',
          ...init.headers,
        },
      });
      if (response.status === 401 || response.status === 403) {
        throw new AccessError(`HTTP ${response.status} for ${new URL(url).origin}`);
      }
      if (!response.ok) {
        const retryAfter = response.headers.get('retry-after');
        const retryAfterMs = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : null;
        throw new HttpError(`HTTP ${response.status} for ${new URL(url).origin}`, response.status, retryAfterMs);
      }
      return response;
    }, this.options.retryCount, this.options.retryDelayMs);
  }

  async json(url: string, init: RequestInit = {}): Promise<{ data: unknown; response: Response }> {
    const response = await this.request(url, init);
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('json')) {
      const text = await response.text();
      if (/showcaptcha|captcha__|вы не робот|are you a robot/i.test(text)) throw new AccessError('CAPTCHA or challenge page received');
      throw new ResponseFormatError(`Expected JSON, received ${contentType || 'unknown content type'}`);
    }
    try {
      return { data: await response.json(), response };
    } catch {
      throw new ResponseFormatError('Response body is not valid JSON');
    }
  }
}
