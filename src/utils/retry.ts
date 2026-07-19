import { AccessError, HttpError, ResponseFormatError } from '../errors.js';
import { sleep } from './sleep.js';

export function isRetryable(error: unknown): boolean {
  if (error instanceof AccessError || error instanceof ResponseFormatError) return false;
  if (error instanceof HttpError) {
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }
  return error instanceof TypeError || (error instanceof Error && error.name === 'AbortError');
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  retryCount: number,
  baseDelayMs: number,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === retryCount || !isRetryable(error)) throw error;
      const retryAfter = error instanceof HttpError ? error.retryAfterMs : null;
      await sleep(retryAfter ?? baseDelayMs * 2 ** attempt);
    }
  }
  throw lastError;
}
