import 'dotenv/config';
import path from 'node:path';
import { ConfigError } from './errors.js';
import type { ReviewSource } from './types.js';

export interface AppConfig {
  yandex: { businessUrl: string; businessId: string };
  twoGis: { businessUrl: string; firmId: string; reviewsKey: string };
  outputPath: string;
  rawDir: string;
  backupDir: string;
  maxPages: number;
  timeoutMs: number;
  delayMs: number;
  retryCount: number;
  userAgent: string;
}

function positiveInt(name: string, fallback: number, allowZero = false): number {
  const raw = process.env[name];
  const value = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isInteger(value) || (allowZero ? value < 0 : value < 1)) {
    throw new ConfigError(`${name} must be ${allowZero ? 'a non-negative' : 'a positive'} integer`);
  }
  return value;
}

function value(name: string): string {
  return process.env[name]?.trim() ?? '';
}

export function loadConfig(selectedSources: ReviewSource[]): AppConfig {
  const yandexId = value('YANDEX_BUSINESS_ID');
  const yandexUrl = value('YANDEX_BUSINESS_URL');
  const twoGisId = value('TWOGIS_FIRM_ID');
  const twoGisUrl = value('TWOGIS_BUSINESS_URL');

  if (selectedSources.includes('yandex') && (!yandexId || !yandexUrl)) {
    throw new ConfigError('YANDEX_BUSINESS_ID and YANDEX_BUSINESS_URL are required');
  }
  if (selectedSources.includes('2gis') && (!twoGisId || !twoGisUrl)) {
    throw new ConfigError('TWOGIS_FIRM_ID and TWOGIS_BUSINESS_URL are required');
  }
  if (yandexId && !/^\d+$/.test(yandexId)) throw new ConfigError('YANDEX_BUSINESS_ID must contain digits only');
  if (twoGisId && !/^\d+$/.test(twoGisId)) throw new ConfigError('TWOGIS_FIRM_ID must contain digits only');

  return {
    yandex: { businessUrl: yandexUrl, businessId: yandexId },
    twoGis: {
      businessUrl: twoGisUrl,
      firmId: twoGisId,
      reviewsKey: value('TWOGIS_REVIEWS_KEY') || '6e7e1929-4ea9-4a5d-8c05-d601860389bd',
    },
    outputPath: path.resolve(value('REVIEWS_OUTPUT_PATH') || './data/reviews.json'),
    rawDir: path.resolve(value('REVIEWS_RAW_DIR') || './data/raw'),
    backupDir: path.resolve(value('REVIEWS_BACKUP_DIR') || './data/backups'),
    maxPages: positiveInt('REVIEWS_MAX_PAGES', 100),
    timeoutMs: positiveInt('REVIEWS_REQUEST_TIMEOUT_MS', 15_000),
    delayMs: positiveInt('REVIEWS_REQUEST_DELAY_MS', 700, true),
    retryCount: positiveInt('REVIEWS_RETRY_COUNT', 3, true),
    userAgent: value('REVIEWS_USER_AGENT') || 'standalone-reviews-parser/1.0',
  };
}
