/**
 * Learning Store — saveLearnedPatterns, mergePatterns
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import {
  loadLearnedPatterns,
  saveLearnedPatterns,
  mergePatterns,
} from '../learning/store.js';
import type { DismissedPattern, LearnedPatterns } from '../learning/store.js';

// ============================================================================
// Helpers
// ============================================================================

function makePattern(overrides: Partial<DismissedPattern> = {}): DismissedPattern {
  return {
    pattern: 'console.log',
    severity: 'WARNING',
    dismissCount: 1,
    lastDismissed: '2026-01-01',
    action: 'suppress',
    ...overrides,
  };
}

const emptyData: LearnedPatterns = { version: 1, dismissedPatterns: [] };

// ============================================================================
// saveLearnedPatterns / loadLearnedPatterns
// ============================================================================

describe('saveLearnedPatterns + loadLearnedPatterns', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'learn-store-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('saves and reloads data correctly', async () => {
    const data: LearnedPatterns = {
      version: 1,
      dismissedPatterns: [makePattern()],
    };

    await saveLearnedPatterns(tmpDir, data);
    const loaded = await loadLearnedPatterns(tmpDir);

    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(1);
    expect(loaded!.dismissedPatterns).toHaveLength(1);
    expect(loaded!.dismissedPatterns[0].pattern).toBe('console.log');
  });

  it('creates the .ca/ directory if it does not exist', async () => {
    const nestedRoot = path.join(tmpDir, 'new-project');
    await saveLearnedPatterns(nestedRoot, emptyData);

    const filePath = path.join(nestedRoot, '.ca', 'learned-patterns.json');
    const raw = await readFile(filePath, 'utf-8');
    expect(JSON.parse(raw).version).toBe(1);
  });

  it('loadLearnedPatterns returns null when file does not exist', async () => {
    const result = await loadLearnedPatterns(path.join(tmpDir, 'nonexistent'));
    expect(result).toBeNull();
  });

  it('loadLearnedPatterns returns null for malformed JSON', async () => {
    const caDir = path.join(tmpDir, '.ca');
    const { mkdir, writeFile } = await import('fs/promises');
    await mkdir(caDir, { recursive: true });
    await writeFile(path.join(caDir, 'learned-patterns.json'), 'NOT JSON', 'utf-8');

    const result = await loadLearnedPatterns(tmpDir);
    expect(result).toBeNull();
  });

  it('loadLearnedPatterns returns null for schema-invalid data', async () => {
    const caDir = path.join(tmpDir, '.ca');
    const { mkdir, writeFile } = await import('fs/promises');
    await mkdir(caDir, { recursive: true });
    // version: 2 is not literal(1) → ZodError
    await writeFile(
      path.join(caDir, 'learned-patterns.json'),
      JSON.stringify({ version: 2, dismissedPatterns: [] }),
      'utf-8',
    );
    const result = await loadLearnedPatterns(tmpDir);
    expect(result).toBeNull();
  });
});

// ============================================================================
// mergePatterns
// ============================================================================

describe('mergePatterns', () => {
  it('adds new patterns that are not present in existing', () => {
    const existing: DismissedPattern[] = [makePattern({ pattern: 'console.log' })];
    const incoming: DismissedPattern[] = [makePattern({ pattern: 'debugger', dismissCount: 1 })];

    const result = mergePatterns(existing, incoming);
    expect(result).toHaveLength(2);
    expect(result.find((p) => p.pattern === 'debugger')).toBeDefined();
  });

  it('increments dismissCount for existing patterns', () => {
    const existing: DismissedPattern[] = [makePattern({ pattern: 'console.log', dismissCount: 3 })];
    const incoming: DismissedPattern[] = [makePattern({ pattern: 'console.log', dismissCount: 2 })];

    const result = mergePatterns(existing, incoming);
    expect(result).toHaveLength(1);
    expect(result[0].dismissCount).toBe(5); // 3 + 2
  });

  it('updates lastDismissed to the incoming value', () => {
    const existing: DismissedPattern[] = [makePattern({ pattern: 'console.log', lastDismissed: '2025-01-01' })];
    const incoming: DismissedPattern[] = [makePattern({ pattern: 'console.log', lastDismissed: '2026-03-21' })];

    const result = mergePatterns(existing, incoming);
    expect(result[0].lastDismissed).toBe('2026-03-21');
  });

  it('does not mutate the existing array', () => {
    const existing: DismissedPattern[] = [makePattern()];
    const incoming: DismissedPattern[] = [makePattern({ pattern: 'new-pattern' })];
    const originalLength = existing.length;

    mergePatterns(existing, incoming);
    expect(existing).toHaveLength(originalLength);
  });

  it('returns a copy of existing when incoming is empty', () => {
    const existing: DismissedPattern[] = [makePattern()];
    const result = mergePatterns(existing, []);
    expect(result).toHaveLength(1);
    expect(result).not.toBe(existing); // new array
  });

  it('handles both arrays empty', () => {
    expect(mergePatterns([], [])).toHaveLength(0);
  });
});
