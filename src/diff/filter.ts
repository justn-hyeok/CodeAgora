import { readFile, access } from 'fs/promises';
import { minimatch } from 'minimatch';
import type { DiffChunk } from './types.js';

async function loadIgnorePatterns(
  ignorePath: string = '.reviewignore'
): Promise<string[]> {
  try {
    await access(ignorePath);
    const content = await readFile(ignorePath, 'utf-8');

    return content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
  } catch {
    // No .reviewignore file, return empty patterns
    return [];
  }
}

function shouldIgnore(filePath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (minimatch(filePath, pattern, { dot: true })) {
      return true;
    }
  }
  return false;
}

export async function filterIgnoredFiles(
  chunks: DiffChunk[]
): Promise<DiffChunk[]> {
  const patterns = await loadIgnorePatterns();

  if (patterns.length === 0) {
    return chunks;
  }

  return chunks.filter((chunk) => !shouldIgnore(chunk.file, patterns));
}
