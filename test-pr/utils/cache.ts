/**
 * Simple In-Memory LRU Cache
 *
 * INTENTIONAL ISSUES:
 * - Academic: Off-by-one error in eviction logic
 * - Academic: Race condition on concurrent access
 * - Academic: O(n) complexity on every eviction
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
}

export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private ttl: number; // milliseconds

  constructor(maxSize: number = 100, ttl: number = 60000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  // ❌ Academic Issue 1: Race condition
  // No locking mechanism - concurrent access can corrupt state
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // ❌ Academic Issue 2: Off-by-one in TTL check
    // Should be `>=` not `>` - items can be accessed exactly at expiry
    const isExpired = Date.now() - entry.timestamp > this.ttl;

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    // Update access count (race condition here)
    entry.accessCount++;
    this.cache.set(key, entry);

    return entry.value;
  }

  // ❌ Academic Issue 3: O(n) eviction on every set
  set(key: string, value: T): void {
    // Check if we need to evict
    if (this.cache.size >= this.maxSize) {
      this.evictLRU(); // O(n) operation - scans entire Map
    }

    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      accessCount: 1
    };

    this.cache.set(key, entry);
  }

  // ❌ Academic Issue 3: Inefficient eviction
  // Scans all entries to find LRU - should use a proper data structure
  private evictLRU(): void {
    let lruKey: string | null = null;
    let minAccessCount = Infinity;

    // O(n) scan - gets worse as cache grows
    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessCount < minAccessCount) {
        minAccessCount = entry.accessCount;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  // ❌ Academic Issue 4: Off-by-one in cleanup
  // Uses `>` instead of `>=` for size check
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      // ❌ Should check >= maxSize, not just >
      if (this.cache.size > this.maxSize || now - entry.timestamp > this.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  // Helper to check cache state
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      // ❌ Academic Issue: This can give misleading stats due to race conditions
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        accessCount: entry.accessCount,
        age: Date.now() - entry.timestamp
      }))
    };
  }
}
