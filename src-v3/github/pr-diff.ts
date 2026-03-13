/**
 * GitHub PR Diff Fetcher
 * Fetches PR metadata and unified diff from the GitHub API.
 */

import { Octokit } from '@octokit/rest';
import type { GitHubConfig, PullRequestInfo } from './client.js';

/**
 * Fetch a pull request's metadata and unified diff.
 *
 * Uses the `diff` media type to retrieve the raw unified diff as a string.
 * Returns a PullRequestInfo containing title, branches, and diff text.
 */
export async function fetchPrDiff(
  config: GitHubConfig,
  prNumber: number
): Promise<PullRequestInfo> {
  const octokit = new Octokit({ auth: config.token });

  // Fetch PR metadata (JSON)
  const { data: pr } = await octokit.pulls.get({
    owner: config.owner,
    repo: config.repo,
    pull_number: prNumber,
  });

  // Fetch raw diff using the diff media type
  const diffResponse = await octokit.pulls.get({
    owner: config.owner,
    repo: config.repo,
    pull_number: prNumber,
    mediaType: { format: 'diff' },
  });

  // When format is 'diff', the response data is the raw diff string
  const diff = diffResponse.data as unknown as string;

  return {
    number: pr.number,
    title: pr.title,
    baseBranch: pr.base.ref,
    headBranch: pr.head.ref,
    diff: typeof diff === 'string' ? diff : '',
  };
}
