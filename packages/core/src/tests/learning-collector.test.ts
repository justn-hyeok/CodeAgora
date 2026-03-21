/**
 * Tests for learning/collector.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Shared mock so every `new Octokit()` call returns the same instance
const mockListReviewComments = vi.fn();

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    pulls: {
      listReviewComments: mockListReviewComments,
    },
  })),
}));

// Import after mock is set up
const { collectDismissedPatterns } = await import('../learning/collector.js');

describe('collectDismissedPatterns', () => {
  beforeEach(() => {
    mockListReviewComments.mockReset();
  });

  it('returns empty array when no comments exist', async () => {
    mockListReviewComments.mockResolvedValue({ data: [] });

    const result = await collectDismissedPatterns('owner', 'repo', 1, 'token');
    expect(result).toEqual([]);
  });

  it('ignores comments without codeagora marker', async () => {
    mockListReviewComments.mockResolvedValue({
      data: [
        { body: 'Regular comment without marker', position: null },
      ],
    });

    const result = await collectDismissedPatterns('owner', 'repo', 1, 'token');
    expect(result).toEqual([]);
  });

  it('ignores comments with marker but without severity/title match', async () => {
    mockListReviewComments.mockResolvedValue({
      data: [
        { body: '<!-- codeagora-v3 -->\nNo severity info here', position: null },
      ],
    });

    const result = await collectDismissedPatterns('owner', 'repo', 1, 'token');
    expect(result).toEqual([]);
  });

  it('collects a CRITICAL pattern from a matching comment', async () => {
    mockListReviewComments.mockResolvedValue({
      data: [
        {
          body: '<!-- codeagora-v3 -->\n**CRITICAL** — SQL injection vulnerability\nsome details',
          position: null,
        },
      ],
    });

    const result = await collectDismissedPatterns('owner', 'repo', 1, 'token');
    expect(result).toHaveLength(1);
    expect(result[0]!.pattern).toBe('SQL injection vulnerability');
    expect(result[0]!.severity).toBe('CRITICAL');
    expect(result[0]!.dismissCount).toBe(1);
    expect(result[0]!.action).toBe('downgrade');
  });

  it('collects a SUGGESTION pattern with suppress action', async () => {
    mockListReviewComments.mockResolvedValue({
      data: [
        {
          body: '<!-- codeagora-v3 -->\n**SUGGESTION** — Use const instead of let\nsome details',
          position: null,
        },
      ],
    });

    const result = await collectDismissedPatterns('owner', 'repo', 1, 'token');
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe('SUGGESTION');
    expect(result[0]!.action).toBe('suppress');
  });

  it('merges duplicate patterns and increments dismissCount', async () => {
    const sameComment = {
      body: '<!-- codeagora-v3 -->\n**WARNING** — Missing null check\ndetails',
      position: null,
    };
    mockListReviewComments.mockResolvedValue({
      data: [sameComment, sameComment],
    });

    const result = await collectDismissedPatterns('owner', 'repo', 1, 'token');
    expect(result).toHaveLength(1);
    expect(result[0]!.dismissCount).toBe(2);
  });

  it('collects multiple distinct patterns as separate entries', async () => {
    mockListReviewComments.mockResolvedValue({
      data: [
        {
          body: '<!-- codeagora-v3 -->\n**CRITICAL** — Pattern A\ndetails',
          position: null,
        },
        {
          body: '<!-- codeagora-v3 -->\n**WARNING** — Pattern B\ndetails',
          position: null,
        },
      ],
    });

    const result = await collectDismissedPatterns('owner', 'repo', 1, 'token');
    expect(result).toHaveLength(2);
    const patterns = result.map((r) => r.pattern);
    expect(patterns).toContain('Pattern A');
    expect(patterns).toContain('Pattern B');
  });

  it('sets lastDismissed to today ISO date', async () => {
    mockListReviewComments.mockResolvedValue({
      data: [
        {
          body: '<!-- codeagora-v3 -->\n**CRITICAL** — Some issue\ndetails',
          position: null,
        },
      ],
    });

    const today = new Date().toISOString().split('T')[0]!;
    const result = await collectDismissedPatterns('owner', 'repo', 1, 'token');
    expect(result[0]!.lastDismissed).toBe(today);
  });
});
