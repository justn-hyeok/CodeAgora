import type { ReviewHistoryEntry, ReviewStats } from '../storage/types.js';
import type { Severity } from '../parser/schema.js';

/**
 * Generate statistics from review history
 */
export function generateStats(history: ReviewHistoryEntry[]): ReviewStats {
  if (history.length === 0) {
    return {
      totalReviews: 0,
      totalIssues: 0,
      totalFiles: 0,
      averageDuration: 0,
      averageIssuesPerReview: 0,
      issuesBySeverity: { CRITICAL: 0, MAJOR: 0, MINOR: 0, SUGGESTION: 0 },
      reviewerUsage: {},
      debateCount: 0,
      supporterCount: 0,
    };
  }

  const totalReviews = history.length;
  const totalIssues = history.reduce((sum, entry) => sum + entry.totalIssues, 0);
  const uniqueFiles = new Set(history.map((entry) => entry.file));
  const totalFiles = uniqueFiles.size;
  const totalDuration = history.reduce((sum, entry) => sum + entry.duration, 0);
  const averageDuration = totalDuration / totalReviews;
  const averageIssuesPerReview = totalIssues / totalReviews;

  // Aggregate severities
  const issuesBySeverity: Record<Severity, number> = {
    CRITICAL: 0,
    MAJOR: 0,
    MINOR: 0,
    SUGGESTION: 0,
  };

  for (const entry of history) {
    for (const severity of Object.keys(issuesBySeverity) as Severity[]) {
      issuesBySeverity[severity] += entry.severities[severity] ?? 0;
    }
  }

  // Aggregate reviewer usage
  const reviewerUsage: Record<string, number> = {};
  for (const entry of history) {
    for (const reviewer of entry.reviewers) {
      reviewerUsage[reviewer] = (reviewerUsage[reviewer] || 0) + 1;
    }
  }

  // Count debates and supporter usage
  const debateCount = history.filter((entry) => entry.debateOccurred).length;
  const supporterCount = history.filter((entry) => entry.supportersUsed > 0).length;

  return {
    totalReviews,
    totalIssues,
    totalFiles,
    averageDuration,
    averageIssuesPerReview,
    issuesBySeverity,
    reviewerUsage,
    debateCount,
    supporterCount,
  };
}

/**
 * Format stats as a terminal report
 */
export function formatStatsReport(stats: ReviewStats): string {
  const lines: string[] = [];

  lines.push('📊 Review Statistics');
  lines.push('');

  // Overview
  lines.push('Overview:');
  lines.push(`  Total Reviews: ${stats.totalReviews}`);
  lines.push(`  Total Files Reviewed: ${stats.totalFiles}`);
  lines.push(`  Total Issues Found: ${stats.totalIssues}`);
  lines.push(`  Average Issues per Review: ${stats.averageIssuesPerReview.toFixed(1)}`);
  lines.push(
    `  Average Duration: ${(stats.averageDuration / 1000).toFixed(1)}s`
  );
  lines.push('');

  // Severities
  lines.push('Issues by Severity:');
  lines.push(`  CRITICAL: ${stats.issuesBySeverity.CRITICAL}`);
  lines.push(`  MAJOR: ${stats.issuesBySeverity.MAJOR}`);
  lines.push(`  MINOR: ${stats.issuesBySeverity.MINOR}`);
  lines.push(`  SUGGESTION: ${stats.issuesBySeverity.SUGGESTION}`);
  lines.push('');

  // Reviewers
  if (Object.keys(stats.reviewerUsage).length > 0) {
    lines.push('Reviewer Usage:');
    const sortedReviewers = Object.entries(stats.reviewerUsage).sort(
      ([, a], [, b]) => b - a
    );
    for (const [reviewer, count] of sortedReviewers) {
      const percentage = ((count / stats.totalReviews) * 100).toFixed(0);
      lines.push(`  ${reviewer}: ${count} (${percentage}%)`);
    }
    lines.push('');
  }

  // Features
  lines.push('Feature Usage:');
  lines.push(`  Debates: ${stats.debateCount} reviews`);
  lines.push(`  Supporters: ${stats.supporterCount} reviews`);

  return lines.join('\n');
}
