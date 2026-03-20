/**
 * GitHub Review Deduplication Tests
 * Tests findPriorReviews() and dismissPriorReviews() with mocked Octokit.
 */

import { describe, it, expect, vi } from 'vitest';
import { findPriorReviews, dismissPriorReviews } from '../dedup.js';
import type { GitHubConfig } from '../client.js';

// ============================================================================
// Helpers
// ============================================================================

const MARKER = '<!-- codeagora-v3 -->';

function makeConfig(): GitHubConfig {
  return { token: 'ghp_test', owner: 'test-owner', repo: 'test-repo' };
}

function makeReview(id: number, body: string) {
  return { id, body, state: 'CHANGES_REQUESTED', user: { login: 'bot' } };
}

function makeOctokit(reviews: Array<{ id: number; body: string }>) {
  return {
    paginate: vi.fn().mockResolvedValue(reviews),
    pulls: {
      listReviews: vi.fn(),
      dismissReview: vi.fn().mockResolvedValue({}),
    },
  };
}

// ============================================================================
// findPriorReviews
// ============================================================================

describe('findPriorReviews', () => {
  it('returns ids of reviews that contain the codeagora-v3 marker', async () => {
    const octokit = makeOctokit([
      makeReview(101, `${MARKER}\nSome content`),
      makeReview(102, 'Unrelated review'),
      makeReview(103, `${MARKER}\nAnother run`),
    ]);

    const ids = await findPriorReviews(makeConfig(), 7, octokit as never);
    expect(ids).toEqual([101, 103]);
  });

  it('returns empty array when no reviews contain the marker', async () => {
    const octokit = makeOctokit([
      makeReview(201, 'No marker here'),
      makeReview(202, 'Also no marker'),
    ]);

    const ids = await findPriorReviews(makeConfig(), 7, octokit as never);
    expect(ids).toEqual([]);
  });

  it('returns empty array when there are no reviews at all', async () => {
    const octokit = makeOctokit([]);
    const ids = await findPriorReviews(makeConfig(), 7, octokit as never);
    expect(ids).toEqual([]);
  });

  it('calls paginate with the correct owner, repo, and pull_number', async () => {
    const octokit = makeOctokit([]);
    await findPriorReviews(makeConfig(), 42, octokit as never);

    expect(octokit.paginate).toHaveBeenCalledOnce();
    const [, params] = octokit.paginate.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(params.owner).toBe('test-owner');
    expect(params.repo).toBe('test-repo');
    expect(params.pull_number).toBe(42);
  });
});

// ============================================================================
// dismissPriorReviews
// ============================================================================

describe('dismissPriorReviews', () => {
  it('dismisses each review id and returns correct dismissed count', async () => {
    const octokit = makeOctokit([]);
    const result = await dismissPriorReviews(makeConfig(), 7, [101, 102, 103], octokit as never);

    expect(octokit.pulls.dismissReview).toHaveBeenCalledTimes(3);
    expect(result.dismissed).toBe(3);
    expect(result.failed).toBe(0);
  });

  it('returns { dismissed: 0, failed: 0 } when reviewIds is empty', async () => {
    const octokit = makeOctokit([]);
    const result = await dismissPriorReviews(makeConfig(), 7, [], octokit as never);

    expect(octokit.pulls.dismissReview).not.toHaveBeenCalled();
    expect(result.dismissed).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('counts failed dismissals non-fatally when dismissReview throws', async () => {
    const octokit = makeOctokit([]);
    octokit.pulls.dismissReview
      .mockResolvedValueOnce({})           // id 101 succeeds
      .mockRejectedValueOnce(new Error('Forbidden'))  // id 102 fails
      .mockResolvedValueOnce({});          // id 103 succeeds

    const result = await dismissPriorReviews(makeConfig(), 7, [101, 102, 103], octokit as never);
    expect(result.dismissed).toBe(2);
    expect(result.failed).toBe(1);
  });

  it('calls dismissReview with correct parameters', async () => {
    const octokit = makeOctokit([]);
    await dismissPriorReviews(makeConfig(), 5, [999], octokit as never);

    const call = octokit.pulls.dismissReview.mock.calls[0][0] as Record<string, unknown>;
    expect(call.owner).toBe('test-owner');
    expect(call.repo).toBe('test-repo');
    expect(call.pull_number).toBe(5);
    expect(call.review_id).toBe(999);
    expect(call.message).toContain('Superseded');
  });

  it('all fail gracefully — returns failed count equal to reviewIds length', async () => {
    const octokit = makeOctokit([]);
    octokit.pulls.dismissReview.mockRejectedValue(new Error('Not allowed'));

    const result = await dismissPriorReviews(makeConfig(), 7, [10, 20], octokit as never);
    expect(result.dismissed).toBe(0);
    expect(result.failed).toBe(2);
  });
});
