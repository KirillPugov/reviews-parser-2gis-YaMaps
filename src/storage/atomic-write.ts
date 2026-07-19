import { copyFile, mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ReviewsOutput } from '../types.js';
import { validateOutput } from './validate-output.js';

export interface AtomicWriteHooks {
  beforeTempWrite?: () => Promise<void> | void;
  beforeRename?: () => Promise<void> | void;
}

export async function atomicWriteOutput(options: {
  outputPath: string;
  backupDir: string;
  output: ReviewsOutput;
  retention?: number;
  hooks?: AtomicWriteHooks;
}): Promise<void> {
  validateOutput(options.output);
  const parent = path.dirname(options.outputPath);
  const temporary = `${options.outputPath}.tmp`;
  await mkdir(parent, { recursive: true });
  await mkdir(options.backupDir, { recursive: true });

  try {
    await options.hooks?.beforeTempWrite?.();
    await writeFile(temporary, `${JSON.stringify(options.output, null, 2)}\n`, 'utf8');
    if (await exists(options.outputPath)) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      await copyFile(options.outputPath, path.join(options.backupDir, `reviews-${stamp}.json`));
    }
    await options.hooks?.beforeRename?.();
    await rename(temporary, options.outputPath);
    await retainNewestBackups(options.backupDir, options.retention ?? 10);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

export async function retainNewestBackups(backupDir: string, retention: number): Promise<void> {
  const entries = (await readdir(backupDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /^reviews-.*\.json$/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .reverse();
  await Promise.all(entries.slice(retention).map((name) => rm(path.join(backupDir, name), { force: true })));
}
