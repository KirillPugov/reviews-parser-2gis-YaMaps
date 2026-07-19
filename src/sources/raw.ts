import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ReviewSource } from '../types.js';

const sensitiveKeys = new Set([
  'csrfToken', 'sessionId', 'reqId', 'cookie', 'authorization', 'ip', 'email',
  'user_agent', 'publicId', 'public_id',
]);

export function sanitizeRaw(value: unknown, parentKey = ''): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeRaw(item, parentKey));
  if (typeof value !== 'object' || value === null) return value;
  const isUserRecord = parentKey === 'user' || parentKey === 'author' || parentKey === 'copyright';
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !sensitiveKeys.has(key) && !(isUserRecord && key === 'id'))
      .map(([key, child]) => [key, sanitizeRaw(child, key)]),
  );
}

export async function saveRawPage(rawDir: string, source: ReviewSource, page: number, value: unknown): Promise<void> {
  await mkdir(rawDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(rawDir, `${source}-page-${String(page).padStart(3, '0')}-${stamp}.json`);
  await writeFile(file, `${JSON.stringify(sanitizeRaw(value), null, 2)}\n`, 'utf8');
}
