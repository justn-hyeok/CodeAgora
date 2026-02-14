import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { ReviewHistoryEntry } from '../../src/storage/types.js';
import { mkdir, writeFile, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock ReviewHistoryStorage that accepts custom directory
class TestReviewHistoryStorage {
  private storageDir: string;
  private historyFile: string;
  private writeQueue = Promise.resolve();

  constructor(baseDir: string) {
    this.storageDir = join(baseDir, '.oh-my-codereview');
    this.historyFile = join(this.storageDir, 'history.json');
  }

  async save(entry: ReviewHistoryEntry): Promise<void> {
    this.writeQueue = this.writeQueue.then(() => this._doSave(entry));
    return this.writeQueue;
  }

  private async _doSave(entry: ReviewHistoryEntry): Promise<void> {
    try {
      await mkdir(this.storageDir, { recursive: true });
      const history = await this.load();
      history.push(entry);
      const rotated = history.slice(-1000);

      const tempFile = `${this.historyFile}.tmp`;
      await writeFile(tempFile, JSON.stringify(rotated, null, 2), 'utf-8');

      // Use rename for atomic write
      const { rename } = await import('fs/promises');
      await rename(tempFile, this.historyFile);
    } catch (error) {
      console.warn(`Failed to save: ${error}`);
    }
  }

  async load(): Promise<ReviewHistoryEntry[]> {
    try {
      const data = await readFile(this.historyFile, 'utf-8');
      return JSON.parse(data) as ReviewHistoryEntry[];
    } catch {
      return [];
    }
  }

  async getLast(count: number): Promise<ReviewHistoryEntry[]> {
    const history = await this.load();
    return history.slice(-count);
  }

  async getByFile(file: string): Promise<ReviewHistoryEntry[]> {
    const history = await this.load();
    return history.filter((entry) => entry.file === file);
  }

  async getCount(): Promise<number> {
    const history = await this.load();
    return history.length;
  }

  async clear(): Promise<void> {
    try {
      await mkdir(this.storageDir, { recursive: true });
      await writeFile(this.historyFile, JSON.stringify([], null, 2), 'utf-8');
    } catch (error) {
      console.warn(`Failed to clear: ${error}`);
    }
  }
}

describe('ReviewHistoryStorage', () => {
  let storage: TestReviewHistoryStorage;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `oh-my-codereview-test-${Date.now()}-${Math.random()}`);
    await mkdir(testDir, { recursive: true });
    storage = new TestReviewHistoryStorage(testDir);
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should return empty array when no history exists', async () => {
    const history = await storage.load();
    expect(history).toEqual([]);
  });

  it('should save and load history entries', async () => {
    const entry: ReviewHistoryEntry = {
      id: 'test-1',
      schemaVersion: 1,
      timestamp: Date.now(),
      file: 'test.ts',
      reviewers: ['reviewer1'],
      totalIssues: 5,
      severities: { CRITICAL: 1, MAJOR: 2, MINOR: 1, SUGGESTION: 1 },
      duration: 1000,
      debateOccurred: false,
      supportersUsed: 0,
    };

    await storage.save(entry);
    const history = await storage.load();

    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(entry);
  });

  it('should append new entries to existing history', async () => {
    const entry1: ReviewHistoryEntry = {
      id: 'test-1',
      schemaVersion: 1,
      timestamp: Date.now(),
      file: 'test1.ts',
      reviewers: ['reviewer1'],
      totalIssues: 3,
      severities: { CRITICAL: 0, MAJOR: 1, MINOR: 1, SUGGESTION: 1 },
      duration: 500,
      debateOccurred: false,
      supportersUsed: 0,
    };

    const entry2: ReviewHistoryEntry = {
      id: 'test-2',
      schemaVersion: 1,
      timestamp: Date.now(),
      file: 'test2.ts',
      reviewers: ['reviewer2'],
      totalIssues: 2,
      severities: { CRITICAL: 0, MAJOR: 0, MINOR: 1, SUGGESTION: 1 },
      duration: 800,
      debateOccurred: false,
      supportersUsed: 0,
    };

    await storage.save(entry1);
    await storage.save(entry2);

    const history = await storage.load();
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual(entry1);
    expect(history[1]).toEqual(entry2);
  });

  it('should get last N entries', async () => {
    const entries: ReviewHistoryEntry[] = Array.from({ length: 5 }, (_, i) => ({
      id: `test-${i}`,
      schemaVersion: 1,
      timestamp: Date.now() + i,
      file: `test${i}.ts`,
      reviewers: ['reviewer1'],
      totalIssues: 1,
      severities: { CRITICAL: 0, MAJOR: 0, MINOR: 0, SUGGESTION: 1 },
      duration: 100,
      debateOccurred: false,
      supportersUsed: 0,
    }));

    for (const entry of entries) {
      await storage.save(entry);
    }

    const last2 = await storage.getLast(2);
    expect(last2).toHaveLength(2);
    expect(last2[0].id).toBe('test-3');
    expect(last2[1].id).toBe('test-4');
  });

  it('should get entries by file', async () => {
    const entry1: ReviewHistoryEntry = {
      id: 'test-1',
      schemaVersion: 1,
      timestamp: Date.now(),
      file: 'foo.ts',
      reviewers: ['reviewer1'],
      totalIssues: 1,
      severities: { CRITICAL: 0, MAJOR: 0, MINOR: 0, SUGGESTION: 1 },
      duration: 100,
      debateOccurred: false,
      supportersUsed: 0,
    };

    const entry2: ReviewHistoryEntry = {
      id: 'test-2',
      schemaVersion: 1,
      timestamp: Date.now(),
      file: 'bar.ts',
      reviewers: ['reviewer1'],
      totalIssues: 1,
      severities: { CRITICAL: 0, MAJOR: 0, MINOR: 0, SUGGESTION: 1 },
      duration: 100,
      debateOccurred: false,
      supportersUsed: 0,
    };

    await storage.save(entry1);
    await storage.save(entry2);

    const fooEntries = await storage.getByFile('foo.ts');
    expect(fooEntries).toHaveLength(1);
    expect(fooEntries[0].id).toBe('test-1');
  });

  it('should get entry count', async () => {
    expect(await storage.getCount()).toBe(0);

    const entry: ReviewHistoryEntry = {
      id: 'test-1',
      schemaVersion: 1,
      timestamp: Date.now(),
      file: 'test.ts',
      reviewers: ['reviewer1'],
      totalIssues: 1,
      severities: { CRITICAL: 0, MAJOR: 0, MINOR: 0, SUGGESTION: 1 },
      duration: 100,
      debateOccurred: false,
      supportersUsed: 0,
    };

    await storage.save(entry);
    expect(await storage.getCount()).toBe(1);
  });

  it('should clear all history', async () => {
    const entry: ReviewHistoryEntry = {
      id: 'test-1',
      schemaVersion: 1,
      timestamp: Date.now(),
      file: 'test.ts',
      reviewers: ['reviewer1'],
      totalIssues: 1,
      severities: { CRITICAL: 0, MAJOR: 0, MINOR: 0, SUGGESTION: 1 },
      duration: 100,
      debateOccurred: false,
      supportersUsed: 0,
    };

    await storage.save(entry);
    expect(await storage.getCount()).toBe(1);

    await storage.clear();
    expect(await storage.getCount()).toBe(0);
  });

  it('should handle corrupted history file gracefully', async () => {
    const historyFile = join(testDir, '.oh-my-codereview', 'history.json');
    await mkdir(join(testDir, '.oh-my-codereview'), { recursive: true });
    await writeFile(historyFile, '{ invalid json }', 'utf-8');

    const history = await storage.load();
    expect(history).toEqual([]);
  });
});
