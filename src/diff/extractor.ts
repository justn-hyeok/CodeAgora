import { execFile as execFileCallback } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import type { DiffResult } from './types.js';
import { splitDiffByFile } from './splitter.js';
import { filterIgnoredFiles } from './filter.js';

const execFile = promisify(execFileCallback);

export async function extractDiff(
  options: {
    path?: string;
    baseBranch?: string;
  } = {}
): Promise<DiffResult> {
  try {
    let diffContent: string;

    if (options.path) {
      // Read diff from file
      try {
        diffContent = await readFile(options.path, 'utf-8');
      } catch (error) {
        return {
          success: false,
          error: `Failed to read diff file: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    } else {
      // Extract diff from git
      const baseBranch = options.baseBranch || 'main';

      // Validate branch name to prevent command injection
      if (!/^[a-zA-Z0-9_\-\/.]+$/.test(baseBranch)) {
        return {
          success: false,
          error: `Invalid branch name: ${baseBranch}. Branch names can only contain alphanumeric characters, hyphens, underscores, slashes, and dots.`,
        };
      }

      try {
        // Use execFile (async) instead of execFileSync for non-blocking execution
        const { stdout } = await execFile('git', ['diff', `${baseBranch}...HEAD`], {
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024, // 10MB
        });
        diffContent = stdout;
      } catch (error) {
        return {
          success: false,
          error: `Failed to extract git diff: ${error instanceof Error ? error.message : String(error)}`,
        };
      }

      if (!diffContent.trim()) {
        return {
          success: false,
          error: 'No changes detected in git diff',
        };
      }
    }

    // Split diff by file
    const chunks = splitDiffByFile(diffContent);

    if (chunks.length === 0) {
      return {
        success: false,
        error: 'No valid diff chunks found',
      };
    }

    // Filter ignored files
    const filteredChunks = await filterIgnoredFiles(chunks);

    if (filteredChunks.length === 0) {
      return {
        success: false,
        error: 'All files are ignored by .reviewignore',
      };
    }

    return {
      success: true,
      chunks: filteredChunks,
    };
  } catch (error) {
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
