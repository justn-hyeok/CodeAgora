/**
 * voting command
 * 75% Majority Voting Gate - Core innovation
 * Separates consensus issues from debate issues
 */

import type {
  VotingOutput,
  ParsedReview,
  ReviewIssue,
  Severity,
  ConsensusIssue,
  DebateIssue,
  IssueGroup,
} from '../types/index.js';
import { VotingInputSchema } from '../types/index.js';

interface MajorityVote {
  severity: Severity;
  count: number;
  total: number;
  confidence: number;
}

/**
 * Calculate majority vote for a group of issues on the same location
 */
function getMajorityVote(issues: ReviewIssue[]): MajorityVote | null {
  if (issues.length === 0) return null;

  const counts = new Map<Severity, number>();

  for (const issue of issues) {
    counts.set(issue.severity, (counts.get(issue.severity) || 0) + 1);
  }

  let maxCount = 0;
  let maxSeverity: Severity = 'suggestion';

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

interface LocationGroup {
  file: string;
  line: number;
  lineEnd?: number;
  title: string;
  issues: Array<ReviewIssue & { reviewer: string }>;
}

export function voting(inputJson: string): string {
  try {
    const input = JSON.parse(inputJson) as unknown;
    const validated = VotingInputSchema.parse(input);
    const reviews = validated.reviews as ParsedReview[];
    const threshold = validated.threshold;

    // Group issues by location (file:line:title)
    const issuesByLocation = new Map<string, LocationGroup>();

    for (const review of reviews) {
      for (const issue of review.issues) {
        const key = `${review.file}:${issue.line}:${issue.title}`;

        if (!issuesByLocation.has(key)) {
          issuesByLocation.set(key, {
            file: review.file,
            line: issue.line,
            lineEnd: issue.lineEnd,
            title: issue.title,
            issues: [],
          });
        }

        issuesByLocation.get(key)!.issues.push({
          ...issue,
          reviewer: review.reviewer,
        });
      }
    }

    const consensusIssues: ConsensusIssue[] = [];
    const debateIssues: DebateIssue[] = [];

    // Apply majority voting gate
    for (const location of issuesByLocation.values()) {
      const majorityVote = getMajorityVote(location.issues);

      if (!majorityVote) continue;

      const issueGroup: IssueGroup = {
        file: location.file,
        line: location.line,
        lineEnd: location.lineEnd,
        title: location.title,
      };

      // Check for low-confidence warnings when MAJORITY is warning
      // This should trigger debate only if UNANIMOUS (100%) but everyone is unsure
      // If only 75% agree, the majority wins regardless of individual confidence
      const hasLowConfidenceWarning =
        majorityVote.severity === 'warning' &&
        majorityVote.confidence >= 0.99 && // Near-unanimous agreement
        location.issues.some((i) => i.severity === 'warning' && i.confidence < 0.7);

      // Check for strong majority (≥threshold)
      // Single reviewer is treated as consensus (100% agreement with self)
      if (majorityVote.confidence >= threshold && !hasLowConfidenceWarning) {
        // Consensus reached
        const voters = location.issues
          .filter((i) => i.severity === majorityVote.severity)
          .map((i) => i.reviewer);

        const suggestions = location.issues
          .filter((i) => i.suggestion)
          .map((i) => i.suggestion!);

        consensusIssues.push({
          issueGroup,
          agreedSeverity: majorityVote.severity,
          confidence: majorityVote.confidence,
          debateRequired: false,
          voters,
          suggestions: suggestions.length > 0 ? suggestions : undefined,
        });
      } else {
        // Needs debate - apply 4-stage trigger logic

        // Build severity distribution
        const severityDistribution: Record<string, number> = {};
        for (const issue of location.issues) {
          severityDistribution[issue.severity] =
            (severityDistribution[issue.severity] || 0) + 1;
        }

        // Check debate triggers:
        // 1. Critical issues without strong majority
        const hasCritical = location.issues.some((i) => i.severity === 'critical');

        // 2. Severity conflicts (already filtered by majority gate)
        const severities = new Set(location.issues.map((i) => i.severity));
        const hasConflict = severities.size > 1;

        // 3. Low confidence warning (already checked above)
        // hasLowConfidenceWarning is already defined

        // 4. Multiple reviewers (3+)
        const multipleReviewers = location.issues.length >= 3;

        // Debate required if any trigger is met
        const debateRequired =
          hasCritical || hasConflict || hasLowConfidenceWarning || multipleReviewers;

        if (debateRequired) {
          debateIssues.push({
            issueGroup,
            severityDistribution: severityDistribution as Record<Severity, number>,
            confidence: majorityVote.confidence,
            debateRequired: true,
            opinions: location.issues.map((issue) => ({
              reviewer: issue.reviewer,
              severity: issue.severity,
              confidence: issue.confidence,
              description: issue.description,
              suggestion: issue.suggestion,
            })),
          });
        } else {
          // Weak consensus - treat as consensus anyway
          const voters = location.issues
            .filter((i) => i.severity === majorityVote.severity)
            .map((i) => i.reviewer);

          const suggestions = location.issues
            .filter((i) => i.suggestion)
            .map((i) => i.suggestion!);

          consensusIssues.push({
            issueGroup,
            agreedSeverity: majorityVote.severity,
            confidence: majorityVote.confidence,
            debateRequired: false,
            voters,
            suggestions: suggestions.length > 0 ? suggestions : undefined,
          });
        }
      }
    }

    const output: VotingOutput = {
      consensusIssues,
      debateIssues,
      stats: {
        totalIssueGroups: issuesByLocation.size,
        consensus: consensusIssues.length,
        needsDebate: debateIssues.length,
      },
    };

    return JSON.stringify(output, null, 2);
  } catch (error) {
    return JSON.stringify(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    );
  }
}
