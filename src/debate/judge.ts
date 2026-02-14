import type { ParsedReview, ReviewIssue, Severity } from '../parser/schema.js';

export interface DebateDecision {
  required: boolean;
  reason: string;
  issues: ReviewIssue[];
}

export interface MajorityVote {
  severity: Severity;
  count: number;
  total: number;
  confidence: number;
}

/**
 * Calculate majority vote for a group of issues on the same location
 * @param issues - Array of issues from different reviewers on the same file:line
 * @returns Majority vote with confidence level, or null if no issues
 */
export function getMajorityVote(issues: ReviewIssue[]): MajorityVote | null {
  if (issues.length === 0) return null;

  const counts = new Map<Severity, number>();

  for (const issue of issues) {
    counts.set(issue.severity, (counts.get(issue.severity) || 0) + 1);
  }

  let maxCount = 0;
  let maxSeverity: Severity = 'MINOR';

  for (const [severity, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      maxSeverity = severity;
    }
  }

  return {
    severity: maxSeverity,
    count: maxCount,
    total: issues.length,
    confidence: maxCount / issues.length,
  };
}

export function shouldDebate(reviews: ParsedReview[]): DebateDecision {
  const allIssues: ReviewIssue[] = [];

  for (const review of reviews) {
    allIssues.push(...review.issues);
  }

  if (allIssues.length === 0) {
    return {
      required: false,
      reason: 'No issues found',
      issues: [],
    };
  }

  // Group issues by location (file:line)
  const issuesByLocation = new Map<string, { file: string; line: number; issues: ReviewIssue[] }>();

  for (const review of reviews) {
    for (const issue of review.issues) {
      const key = `${review.file}:${issue.line}`;

      if (!issuesByLocation.has(key)) {
        issuesByLocation.set(key, { file: review.file, line: issue.line, issues: [] });
      }

      issuesByLocation.get(key)!.issues.push(issue);
    }
  }

  // Apply majority voting gate: filter out locations with strong majority (≥75%)
  // Requires at least 2 reviewers (single reviewer doesn't constitute a "majority vote")
  const locationsNeedingDebate = new Map<string, { file: string; line: number; issues: ReviewIssue[] }>();
  let skippedByMajority = 0;

  for (const [key, location] of issuesByLocation) {
    const majorityVote = getMajorityVote(location.issues);

    if (majorityVote && majorityVote.total >= 2 && majorityVote.confidence >= 0.75) {
      // Strong majority (75%+) with multiple reviewers: skip debate for this location
      skippedByMajority++;
      continue;
    }

    // This location needs debate consideration
    locationsNeedingDebate.set(key, location);
  }

  // If all locations have strong majority, no debate needed
  if (locationsNeedingDebate.size === 0) {
    return {
      required: false,
      reason: `All ${issuesByLocation.size} location(s) resolved by strong majority vote (≥75%)`,
      issues: [],
    };
  }

  // Now check remaining locations for debate triggers
  // 1. Check for critical issues (without strong majority)
  const debateIssues: ReviewIssue[] = [];

  for (const { issues } of locationsNeedingDebate.values()) {
    const criticalIssues = issues.filter((i) => i.severity === 'CRITICAL');
    if (criticalIssues.length > 0) {
      debateIssues.push(...criticalIssues);
    }
  }

  if (debateIssues.length > 0) {
    return {
      required: true,
      reason: `${debateIssues.length} critical issue(s) without strong majority`,
      issues: debateIssues,
    };
  }

  // 2. Check for severity conflicts (already filtered by majority gate)
  for (const { file, line, issues } of locationsNeedingDebate.values()) {
    if (issues.length > 1) {
      const severities = new Set(issues.map((i) => i.severity));
      if (severities.size > 1) {
        return {
          required: true,
          reason: `Conflicting severity opinions on ${file}:${line}`,
          issues,
        };
      }
    }
  }

  // 3. Check for low confidence on major issues
  const lowConfidenceMajor: ReviewIssue[] = [];
  for (const { issues } of locationsNeedingDebate.values()) {
    lowConfidenceMajor.push(...issues.filter((i) => i.severity === 'MAJOR' && i.confidence < 0.7));
  }

  if (lowConfidenceMajor.length > 0) {
    return {
      required: true,
      reason: `${lowConfidenceMajor.length} major issue(s) with low confidence`,
      issues: lowConfidenceMajor,
    };
  }

  // 4. Check for multiple reviewers pointing to same area (3+ reviewers)
  for (const { file, line, issues } of locationsNeedingDebate.values()) {
    if (issues.length >= 3) {
      return {
        required: true,
        reason: `${issues.length} reviewers identified issues on ${file}:${line}`,
        issues,
      };
    }
  }

  return {
    required: false,
    reason: `No debate triggers found (${skippedByMajority} location(s) skipped by majority vote)`,
    issues: [],
  };
}
