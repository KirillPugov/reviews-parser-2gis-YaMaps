#!/usr/bin/env node

import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateOutput } from '../dist/storage/validate-output.js';

const filePath = resolve(process.argv[2] || 'data/reviews.json');

try {
  const info = await stat(filePath);
  if (!info.isFile() || info.size === 0) throw new Error('file is missing or empty');

  const value = JSON.parse(await readFile(filePath, 'utf8'));
  validateOutput(value);
  if (value.reviews.length === 0) throw new Error('reviews array is suspiciously empty');
  if (value.sources.yandex.status === 'failed' && value.sources['2gis'].status === 'failed') {
    throw new Error('both parser sources failed');
  }

  console.log(`Validated ${value.reviews.length} reviews in ${filePath}`);
} catch (error) {
  console.error(`Review output validation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
