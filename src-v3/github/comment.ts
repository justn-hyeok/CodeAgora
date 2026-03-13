/**
 * GitHub PR Comment Utilities
 * Functions for posting, finding, and updating PR comments via the GitHub API.
 */

import { Octokit } from '@octokit/rest';
import type { GitHubConfig } from './client.js';

/**
 * Post a new comment on a pull request.
 * Returns the created comment's id and html_url.
 */
export async function postPrComment(
  config: GitHubConfig,
  prNumber: number,
  body: string
): Promise<{ id: number; url: string }> {
  const octokit = new Octokit({ auth: config.token });

  const { data } = await octokit.issues.createComment({
    owner: config.owner,
    repo: config.repo,
    issue_number: prNumber,
    body,
  });

  return { id: data.id, url: data.html_url };
}

/**
 * Find an existing comment on a pull request whose body contains the given marker string.
 * Returns the comment id if found, or null if no matching comment exists.
 */
export async function findExistingComment(
  config: GitHubConfig,
  prNumber: number,
  marker: string
): Promise<{ id: number } | null> {
  const octokit = new Octokit({ auth: config.token });

  // Paginate through all comments to find a match
  const comments = await octokit.paginate(octokit.issues.listComments, {
    owner: config.owner,
    repo: config.repo,
    issue_number: prNumber,
    per_page: 100,
  });

  const found = comments.find((c) => c.body?.includes(marker));
  return found ? { id: found.id } : null;
}

/**
 * Update an existing PR comment by id.
 */
export async function updatePrComment(
  config: GitHubConfig,
  commentId: number,
  body: string
): Promise<void> {
  const octokit = new Octokit({ auth: config.token });

  await octokit.issues.updateComment({
    owner: config.owner,
    repo: config.repo,
    comment_id: commentId,
    body,
  });
}
