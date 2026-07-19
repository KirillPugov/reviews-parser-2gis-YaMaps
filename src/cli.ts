#!/usr/bin/env node
import { loadConfig } from './config.js';
import { logger } from './logger.js';
import { YandexReviewsSource } from './sources/yandex/yandex-source.js';
import { TwoGisReviewsSource } from './sources/two-gis/two-gis-source.js';
import { readExisting } from './storage/read-existing.js';
import { mergeReviews } from './storage/merge-reviews.js';
import { validateOutput } from './storage/validate-output.js';
import { atomicWriteOutput } from './storage/atomic-write.js';
import type { ReviewSource, SourceResult } from './types.js';

interface CliOptions {
  sources: ReviewSource[];
  dryRun: boolean;
  saveRaw: boolean;
  allowEmptySource: boolean;
}

export function parseArgs(args: string[]): CliOptions {
  let sources: ReviewSource[] = ['yandex', '2gis'];
  let dryRun = false;
  let saveRaw = false;
  let allowEmptySource = false;
  for (const arg of args) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--save-raw') saveRaw = true;
    else if (arg === '--allow-empty-source') allowEmptySource = true;
    else if (arg.startsWith('--source=')) {
      const source = arg.slice('--source='.length);
      if (source !== 'yandex' && source !== '2gis') throw new Error('--source must be yandex or 2gis');
      sources = [source];
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { sources, dryRun, saveRaw, allowEmptySource };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const config = loadConfig(options.sources);
  const previous = await readExisting(config.outputPath);
  const jobs: Promise<SourceResult>[] = [];
  if (options.sources.includes('yandex')) jobs.push(new YandexReviewsSource(config).fetch(options));
  if (options.sources.includes('2gis')) jobs.push(new TwoGisReviewsSource(config).fetch(options));
  const results = await Promise.all(jobs);
  const output = mergeReviews({
    previous,
    selectedSources: options.sources,
    results,
    allowEmptySource: options.allowEmptySource,
  });
  validateOutput(output);

  for (const result of results) {
    const label = result.source === 'yandex' ? 'Yandex' : '2GIS';
    logger.info(`${label}: ${result.ok ? 'ok' : 'failed'}, ${result.reviews.length} reviews, ${result.pages} pages${result.error ? ` — ${result.error}` : ''}`);
  }
  logger.info(`Merged: ${output.reviews.length} unique reviews`);
  if (options.dryRun) logger.info('Dry run: output file was not changed');
  else {
    await atomicWriteOutput({ outputPath: config.outputPath, backupDir: config.backupDir, output });
    logger.info(`Output: ${config.outputPath}`);
  }

  if (results.length > 0 && results.every((result) => !result.ok)) process.exitCode = 1;
}

main().catch((error) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
