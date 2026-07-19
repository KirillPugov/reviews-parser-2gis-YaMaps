import { readFile } from 'node:fs/promises';
import { validateOutput } from './validate-output.js';
import type { ReviewsOutput } from '../types.js';

export async function readExisting(filePath: string): Promise<ReviewsOutput | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'));
    validateOutput(parsed);
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new Error(`Existing output is not valid: ${error instanceof Error ? error.message : String(error)}`);
  }
}
