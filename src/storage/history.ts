import { readFile, writeFile, rename, mkdir, stat } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import type { ReviewHistoryEntry } from './types.js';
import { ReviewHistoryEntrySchema } from './types.js';
import { z } from 'zod';
import { HistoryCache } from './cache.js';

const STORAGE_DIR = join(homedir(), '.oh-my-codereview');
const HISTORY_FILE = join(STORAGE_DIR, 'history.json');
const MAX_ENTRIES = 1000;

/**
 * Review history storage manager
 */
export class ReviewHistoryStorage {
  private writeQueue = Promise.resolve();
  private cache = new HistoryCache();

  /**
   * Save a review history entry (queued to prevent race conditions)
   */
  async save(entry: ReviewHistoryEntry): Promise<void> {
    this.writeQueue = this.writeQueue.then(() => this._doSave(entry));
    return this.writeQueue;
  }

  /**
   * Internal save implementation
   */
  private async _doSave(entry: ReviewHistoryEntry): Promise<void> {
    try {
      // Ensure storage directory exists
      await mkdir(STORAGE_DIR, { recursive: true });

      // Load existing history (bypass cache for writes)
      const history = await this.load(false);

      // Add new entry
      history.push(entry);

      // Rotate if needed (keep only last MAX_ENTRIES)
      const rotated = history.slice(-MAX_ENTRIES);

      // Write back (atomic: write to temp file, then rename)
      const tempFile = `${HISTORY_FILE}.tmp`;
      await writeFile(tempFile, JSON.stringify(rotated, null, 2), 'utf-8');

      // Atomic rename (POSIX atomic operation)
      await rename(tempFile, HISTORY_FILE);

      // Invalidate cache after write
      this.cache.clear();
    } catch (error) {
      // Don't crash if history save fails
      console.warn(
        `Failed to save review history: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Load all review history entries (with optional caching)
   */
  async load(useCache = true): Promise<ReviewHistoryEntry[]> {
    try {
      // Check cache first if enabled
      if (useCache) {
        const fileStat = await stat(HISTORY_FILE);
        const cached = this.cache.get(fileStat.mtimeMs);
        if (cached) {
          return cached;
        }
      }

      const data = await readFile(HISTORY_FILE, 'utf-8');
      const parsed = JSON.parse(data);

      // Validate with zod
      const arraySchema = z.array(ReviewHistoryEntrySchema);
      const result = arraySchema.safeParse(parsed);

      let validEntries: ReviewHistoryEntry[];

      if (!result.success) {
        console.warn('History file contains invalid entries, filtering them out');
        // Try to salvage valid entries
        if (Array.isArray(parsed)) {
          validEntries = parsed.filter((entry) => {
            const entryResult = ReviewHistoryEntrySchema.safeParse(entry);
            return entryResult.success;
          }) as ReviewHistoryEntry[];
        } else {
          validEntries = [];
        }
      } else {
        validEntries = result.data;
      }

      // Update cache
      if (useCache) {
        const fileStat = await stat(HISTORY_FILE);
        this.cache.set(validEntries, fileStat.mtimeMs);
      }

      return validEntries;
    } catch {
      // File doesn't exist yet or is corrupted
      return [];
    }
  }

  /**
   * Get the last N review entries
   */
  async getLast(count: number): Promise<ReviewHistoryEntry[]> {
    const history = await this.load();
    return history.slice(-count);
  }

  /**
   * Get review entries for a specific file
   */
  async getByFile(file: string): Promise<ReviewHistoryEntry[]> {
    const history = await this.load();
    return history.filter((entry) => entry.file === file);
  }

  /**
   * Get review count
   */
  async getCount(): Promise<number> {
    const history = await this.load();
    return history.length;
  }

  /**
   * Clear all review history (queued to prevent race conditions)
   */
  async clear(): Promise<void> {
    this.writeQueue = this.writeQueue.then(() => this._doClear());
    return this.writeQueue;
  }

  /**
   * Internal clear implementation
   */
  private async _doClear(): Promise<void> {
    try {
      await mkdir(STORAGE_DIR, { recursive: true });

      // Atomic write: write to temp file, then rename
      const tempFile = `${HISTORY_FILE}.tmp`;
      await writeFile(tempFile, JSON.stringify([], null, 2), 'utf-8');
      await rename(tempFile, HISTORY_FILE);

      // Invalidate cache after clear
      this.cache.clear();
    } catch (error) {
      console.warn(
        `Failed to clear review history: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
