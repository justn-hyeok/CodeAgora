import type { ParsedReview, ReviewIssue, Severity } from '../parser/schema.js';

export interface SynthesizedIssue extends ReviewIssue {
  file: string;
  reviewers: string[];
  votes: Record<Severity, number>;
  agreedSeverity: Severity;
}

export interface SynthesisResult {
  issues: SynthesizedIssue[];
  totalIssues: number;
  bySeverity: Record<Severity, number>;
}

function voteOnSeverity(issues: ReviewIssue[]): Severity {
  const votes: Record<Severity, number> = {
    CRITICAL: 0,
    MAJOR: 0,
    MINOR: 0,
    SUGGESTION: 0,
  };

  for (const issue of issues) {
    votes[issue.severity]++;
  }

  // Find severity with most votes (majority voting)
  let maxVotes = 0;
  let winnerSeverity: Severity = 'SUGGESTION';

  // Iterate in priority order so ties escalate to higher severity
  const severities: Severity[] = ['CRITICAL', 'MAJOR', 'MINOR', 'SUGGESTION'];

  for (const severity of severities) {
    if (votes[severity] > maxVotes) {
      maxVotes = votes[severity];
      winnerSeverity = severity;
    }
  }

  return winnerSeverity;
}

export function synthesizeReviews(reviews: ParsedReview[]): SynthesisResult {
  const issueGroups = new Map<string, { issues: ReviewIssue[]; reviewers: string[]; file: string }>();

  // Group issues by file, line, and category
  for (const review of reviews) {
    for (const issue of review.issues) {
      const key = `${review.file}:${issue.line}-${issue.category}`;

      if (!issueGroups.has(key)) {
        issueGroups.set(key, { issues: [], reviewers: [], file: review.file });
      }

      const group = issueGroups.get(key)!;
      group.issues.push(issue);
      group.reviewers.push(review.reviewer);
    }
  }

  // Synthesize each group
  const synthesizedIssues: SynthesizedIssue[] = [];

  for (const group of issueGroups.values()) {
    const firstIssue = group.issues[0];

    const votes: Record<Severity, number> = {
      CRITICAL: 0,
      MAJOR: 0,
      MINOR: 0,
      SUGGESTION: 0,
    };

    for (const issue of group.issues) {
      votes[issue.severity]++;
    }

    const agreedSeverity = voteOnSeverity(group.issues);

    // Find best description and suggestion
    const bestIssue = group.issues.reduce((best, current) => {
      if (current.confidence > best.confidence) return current;
      if (current.description && !best.description) return current;
      return best;
    }, firstIssue);

    synthesizedIssues.push({
      ...bestIssue,
      file: group.file,
      agreedSeverity,
      reviewers: group.reviewers,
      votes,
    });
  }

  // Sort by severity then line number
  const severityOrder: Record<Severity, number> = {
    CRITICAL: 0,
    MAJOR: 1,
    MINOR: 2,
    SUGGESTION: 3,
  };

  synthesizedIssues.sort((a, b) => {
    const severityDiff = severityOrder[a.agreedSeverity] - severityOrder[b.agreedSeverity];
    if (severityDiff !== 0) return severityDiff;
    return a.line - b.line;
  });

  // Count by severity
  const bySeverity: Record<Severity, number> = {
    CRITICAL: 0,
    MAJOR: 0,
    MINOR: 0,
    SUGGESTION: 0,
  };

  for (const issue of synthesizedIssues) {
    bySeverity[issue.agreedSeverity]++;
  }

  return {
    issues: synthesizedIssues,
    totalIssues: synthesizedIssues.length,
    bySeverity,
  };
}
