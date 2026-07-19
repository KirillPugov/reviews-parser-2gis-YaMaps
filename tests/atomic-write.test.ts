import { mkdtemp, readFile, rm, writeFile, mkdir, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { atomicWriteOutput, retainNewestBackups } from '../src/storage/atomic-write.js';
import { validateOutput } from '../src/storage/validate-output.js';
import type { ReviewsOutput } from '../src/types.js';

const roots: string[] = [];
const valid: ReviewsOutput = { schemaVersion: 1, generatedAt: '2026-07-16T00:00:00.000Z', sources: {
  yandex: { status: 'ok', fetchedAt: '2026-07-16T00:00:00.000Z', count: 0, error: null },
  '2gis': { status: 'ok', fetchedAt: '2026-07-16T00:00:00.000Z', count: 0, error: null },
}, reviews: [] };

async function root(): Promise<string> { const dir = await mkdtemp(path.join(os.tmpdir(), 'reviews-parser-')); roots.push(dir); return dir; }
afterEach(async () => { await Promise.all(roots.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });

describe('atomic output', () => {
  it('rejects invalid output', () => {
    expect(() => validateOutput({ ...valid, schemaVersion: 2 })).toThrow();
  });

  it('writes valid JSON and creates a backup on replacement', async () => {
    const dir = await root(); const outputPath = path.join(dir, 'data', 'reviews.json'); const backupDir = path.join(dir, 'backups');
    await mkdir(path.dirname(outputPath), { recursive: true }); await writeFile(outputPath, JSON.stringify(valid));
    await atomicWriteOutput({ outputPath, backupDir, output: { ...valid, generatedAt: '2026-07-16T01:00:00.000Z' } });
    expect(JSON.parse(await readFile(outputPath, 'utf8')).generatedAt).toBe('2026-07-16T01:00:00.000Z');
    expect((await readdir(backupDir)).length).toBe(1);
  });

  it('preserves old data when temp write fails', async () => {
    const dir = await root(); const outputPath = path.join(dir, 'reviews.json'); const backupDir = path.join(dir, 'backups');
    await writeFile(outputPath, 'old');
    await expect(atomicWriteOutput({ outputPath, backupDir, output: valid, hooks: { beforeTempWrite: () => { throw new Error('temp failed'); } } })).rejects.toThrow('temp failed');
    expect(await readFile(outputPath, 'utf8')).toBe('old');
  });

  it('preserves old data when replacement fails', async () => {
    const dir = await root(); const outputPath = path.join(dir, 'reviews.json'); const backupDir = path.join(dir, 'backups');
    await writeFile(outputPath, 'old');
    await expect(atomicWriteOutput({ outputPath, backupDir, output: valid, hooks: { beforeRename: () => { throw new Error('rename failed'); } } })).rejects.toThrow('rename failed');
    expect(await readFile(outputPath, 'utf8')).toBe('old');
  });

  it('retains only the newest backups', async () => {
    const dir = await root();
    for (let index = 0; index < 12; index += 1) await writeFile(path.join(dir, `reviews-${String(index).padStart(2, '0')}.json`), '{}');
    await retainNewestBackups(dir, 10);
    expect((await readdir(dir)).length).toBe(10);
  });
});
