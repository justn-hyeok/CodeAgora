/**
 * Diff Parser Tests
 * Tests buildDiffPositionIndex(), resolvePosition(), resolveLineRange()
 */

import { describe, it, expect } from 'vitest';
import {
  buildDiffPositionIndex,
  resolvePosition,
  resolveLineRange,
} from '../diff-parser.js';

// ============================================================================
// Helpers
// ============================================================================

/** Minimal unified diff for a single file with one hunk. */
function simpleDiff(fileName: string, startLine: number, lines: string[]): string {
  const parts = [
    `--- a/${fileName}`,
    `+++ b/${fileName}`,
    `@@ -${startLine},${lines.length} +${startLine},${lines.length} @@`,
    ...lines,
  ];
  return parts.join('\n');
}

// ============================================================================
// buildDiffPositionIndex
// ============================================================================

describe('buildDiffPositionIndex', () => {
  it('returns an empty index for an empty diff string', () => {
    expect(buildDiffPositionIndex('')).toEqual({});
  });

  it('indexes added lines (+) with correct positions', () => {
    const diff = [
      '--- a/src/foo.ts',
      '+++ b/src/foo.ts',
      '@@ -1,2 +1,3 @@',
      ' context line',
      '+added line',
      ' another context',
    ].join('\n');

    const index = buildDiffPositionIndex(diff);
    // @@ is position 1; " context line" is position 2 (line 1); "+added line" is position 3 (line 2); " another context" is position 4 (line 3)
    expect(index['src/foo.ts:1']).toBe(2);
    expect(index['src/foo.ts:2']).toBe(3);
    expect(index['src/foo.ts:3']).toBe(4);
  });

  it('counts deleted lines (-) toward position but does not index them as new lines', () => {
    const diff = [
      '--- a/src/bar.ts',
      '+++ b/src/bar.ts',
      '@@ -1,2 +1,1 @@',
      '-deleted line',
      ' context line',
    ].join('\n');

    const index = buildDiffPositionIndex(diff);
    // @@ = pos 1, "-deleted" = pos 2 (not indexed), " context" = pos 3 (line 1)
    expect(index['src/bar.ts:1']).toBe(3);
    // deleted line is NOT in the index
    expect(Object.keys(index)).toHaveLength(1);
  });

  it('handles a new file diff (no --- a/ prefix)', () => {
    const diff = [
      '--- /dev/null',
      '+++ b/src/new.ts',
      '@@ -0,0 +1,2 @@',
      '+line one',
      '+line two',
    ].join('\n');

    const index = buildDiffPositionIndex(diff);
    expect(index['src/new.ts:1']).toBe(2);
    expect(index['src/new.ts:2']).toBe(3);
  });

  it('handles a deleted file diff ("+++ /dev/null") — no entries indexed', () => {
    const diff = [
      '--- a/src/old.ts',
      '+++ /dev/null',
      '@@ -1,2 +0,0 @@',
      '-line one',
      '-line two',
    ].join('\n');

    const index = buildDiffPositionIndex(diff);
    expect(Object.keys(index)).toHaveLength(0);
  });

  it('skips binary file lines', () => {
    const diff = [
      'diff --git a/image.png b/image.png',
      'Binary files a/image.png and b/image.png differ',
    ].join('\n');

    const index = buildDiffPositionIndex(diff);
    expect(Object.keys(index)).toHaveLength(0);
  });

  it('skips "No newline at end of file" lines without counting as position', () => {
    const diff = [
      '--- a/src/foo.ts',
      '+++ b/src/foo.ts',
      '@@ -1,1 +1,1 @@',
      '+added line',
      '\\ No newline at end of file',
    ].join('\n');

    const index = buildDiffPositionIndex(diff);
    // Only 1 entry: the added line at position 2
    expect(index['src/foo.ts:1']).toBe(2);
    expect(Object.keys(index)).toHaveLength(1);
  });

  it('handles multiple files in a single diff', () => {
    const diff = [
      '--- a/a.ts',
      '+++ b/a.ts',
      '@@ -1,1 +1,1 @@',
      '+line in a',
      '--- a/b.ts',
      '+++ b/b.ts',
      '@@ -1,1 +1,1 @@',
      '+line in b',
    ].join('\n');

    const index = buildDiffPositionIndex(diff);
    expect(index['a.ts:1']).toBeDefined();
    expect(index['b.ts:1']).toBeDefined();
  });

  it('resets position counter per file', () => {
    const diff = [
      '--- a/a.ts',
      '+++ b/a.ts',
      '@@ -1,1 +1,1 @@',
      '+only line',
      '--- a/b.ts',
      '+++ b/b.ts',
      '@@ -1,1 +1,1 @@',
      '+only line',
    ].join('\n');

    const index = buildDiffPositionIndex(diff);
    // Both files' first added line should be at position 2 (after their own @@ header)
    expect(index['a.ts:1']).toBe(2);
    expect(index['b.ts:1']).toBe(2);
  });

  it('handles hunk starting at a non-1 line number', () => {
    const diff = [
      '--- a/src/utils.ts',
      '+++ b/src/utils.ts',
      '@@ -42,3 +42,4 @@',
      ' context at 42',
      '+new line at 43',
      ' context at 44',
    ].join('\n');

    const index = buildDiffPositionIndex(diff);
    expect(index['src/utils.ts:42']).toBe(2);
    expect(index['src/utils.ts:43']).toBe(3);
    expect(index['src/utils.ts:44']).toBe(4);
  });

  it('strips b/ prefix from +++ b/path lines', () => {
    const diff = simpleDiff('src/deep/path/file.ts', 1, ['+added']);
    const index = buildDiffPositionIndex(diff);
    expect(index['src/deep/path/file.ts:1']).toBeDefined();
  });
});

// ============================================================================
// resolvePosition
// ============================================================================

describe('resolvePosition', () => {
  it('returns the position for an existing file:line key', () => {
    const index = { 'src/foo.ts:10': 5 };
    expect(resolvePosition(index, 'src/foo.ts', 10)).toBe(5);
  });

  it('returns null for a file not present in the index', () => {
    const index = { 'src/foo.ts:10': 5 };
    expect(resolvePosition(index, 'src/other.ts', 10)).toBeNull();
  });

  it('returns null for a line not present in the index', () => {
    const index = { 'src/foo.ts:10': 5 };
    expect(resolvePosition(index, 'src/foo.ts', 99)).toBeNull();
  });

  it('returns null for an empty index', () => {
    expect(resolvePosition({}, 'src/foo.ts', 1)).toBeNull();
  });
});

// ============================================================================
// resolveLineRange
// ============================================================================

describe('resolveLineRange', () => {
  it('returns position of the first line in range when it is indexed', () => {
    const index = { 'src/foo.ts:10': 3, 'src/foo.ts:11': 4 };
    expect(resolveLineRange(index, 'src/foo.ts', [10, 11])).toBe(3);
  });

  it('scans forward when start line is not indexed but a later line is', () => {
    const index = { 'src/foo.ts:12': 5 };
    // 10, 11 not indexed — should fall through to 12
    expect(resolveLineRange(index, 'src/foo.ts', [10, 12])).toBe(5);
  });

  it('returns null when no line in the range is indexed', () => {
    const index = { 'src/foo.ts:20': 7 };
    expect(resolveLineRange(index, 'src/foo.ts', [10, 15])).toBeNull();
  });

  it('handles single-line range [n, n]', () => {
    const index = { 'src/foo.ts:5': 2 };
    expect(resolveLineRange(index, 'src/foo.ts', [5, 5])).toBe(2);
  });

  it('returns null for an empty index', () => {
    expect(resolveLineRange({}, 'src/foo.ts', [1, 10])).toBeNull();
  });
});
