import type { ReviewHistoryEntry } from './types.js';

/**
 * Simple in-memory cache for review history
 * Reduces repeated file reads when querying history multiple times
 */
export class HistoryCache {
  private cache: ReviewHistoryEntry[] | null = null;
  private lastModified: number = 0;

  /**
   * Get cached history if valid
   */
  get(currentModified: number): ReviewHistoryEntry[] | null {
    if (this.cache && this.lastModified === currentModified) {
      return this.cache;
    }
    return null;
  }

  /**
   * Update cache
   */
  set(history: ReviewHistoryEntry[], modified: number): void {
    this.cache = history;
    this.lastModified = modified;
  }

  /**
   * Invalidate cache
   */
  clear(): void {
    this.cache = null;
    this.lastModified = 0;
  }
}
