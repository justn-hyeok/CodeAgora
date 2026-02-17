/**
 * L2 Writer - Discussion & Report Writer
 * Writes discussion logs and moderator report
 */

import type { Discussion, DiscussionRound, DiscussionVerdict, ModeratorReport } from '../types/core.js';
import { writeMarkdown, appendMarkdown, getDiscussionsDir, getUnconfirmedDir, getSuggestionsPath, getReportPath } from '../utils/fs.js';
import path from 'path';

// ============================================================================
// Discussion Writers
// ============================================================================

/**
 * Write discussion round to file
 */
export async function writeDiscussionRound(
  date: string,
  sessionId: string,
  discussionId: string,
  round: DiscussionRound
): Promise<void> {
  const discussionsDir = getDiscussionsDir(date, sessionId);
  const discussionDir = path.join(discussionsDir, discussionId);
  const roundFile = path.join(discussionDir, `round-${round.round}.md`);

  // Ensure discussion directory exists
  const { ensureDir } = await import('../utils/fs.js');
  await ensureDir(discussionDir);

  const content = formatDiscussionRound(round);
  await writeMarkdown(roundFile, content);
}

/**
 * Write discussion verdict
 */
export async function writeDiscussionVerdict(
  date: string,
  sessionId: string,
  verdict: DiscussionVerdict
): Promise<void> {
  const discussionsDir = getDiscussionsDir(date, sessionId);
  const discussionDir = path.join(discussionsDir, verdict.discussionId);
  const verdictFile = path.join(discussionDir, 'verdict.md');

  // Ensure discussion directory exists
  const { ensureDir } = await import('../utils/fs.js');
  await ensureDir(discussionDir);

  const content = formatVerdict(verdict);
  await writeMarkdown(verdictFile, content);
}

/**
 * Write suggestions to suggestions.md
 */
export async function writeSuggestions(
  date: string,
  sessionId: string,
  suggestions: any[]
): Promise<void> {
  const suggestionsPath = getSuggestionsPath(date, sessionId);

  const lines: string[] = [];
  lines.push('# Suggestions');
  lines.push('');
  lines.push('These are low-priority suggestions that did not trigger Discussion.');
  lines.push('');

  for (const suggestion of suggestions) {
    lines.push(`## ${suggestion.issueTitle}`);
    lines.push('');
    lines.push(`**File:** ${suggestion.filePath}:${suggestion.lineRange[0]}-${suggestion.lineRange[1]}`);
    lines.push('');
    lines.push(suggestion.suggestion);
    lines.push('');
  }

  await writeMarkdown(suggestionsPath, lines.join('\n'));
}

/**
 * Write moderator report
 */
export async function writeModeratorReport(
  date: string,
  sessionId: string,
  report: ModeratorReport
): Promise<void> {
  const reportPath = getReportPath(date, sessionId);

  const content = formatModeratorReport(report);
  await writeMarkdown(reportPath, content);
}

// ============================================================================
// Formatters
// ============================================================================

function formatDiscussionRound(round: DiscussionRound): string {
  const lines: string[] = [];

  lines.push(`# Round ${round.round}`);
  lines.push('');
  lines.push('## Moderator Prompt');
  lines.push('');
  lines.push(round.moderatorPrompt);
  lines.push('');

  lines.push('## Supporter Responses');
  lines.push('');

  for (const response of round.supporterResponses) {
    lines.push(`### ${response.supporterId} (${response.stance.toUpperCase()})`);
    lines.push('');
    lines.push(response.response);
    lines.push('');
  }

  return lines.join('\n');
}

function formatVerdict(verdict: DiscussionVerdict): string {
  const lines: string[] = [];

  lines.push(`# Verdict: ${verdict.discussionId}`);
  lines.push('');
  lines.push(`**Final Severity:** ${verdict.finalSeverity}`);
  lines.push(`**Consensus Reached:** ${verdict.consensusReached ? 'Yes' : 'No (Escalated)'}`);
  lines.push(`**Rounds:** ${verdict.rounds}`);
  lines.push('');

  lines.push('## Reasoning');
  lines.push('');
  lines.push(verdict.reasoning);
  lines.push('');

  return lines.join('\n');
}

function formatModeratorReport(report: ModeratorReport): string {
  const lines: string[] = [];

  lines.push('# Moderator Report');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Total Discussions:** ${report.summary.totalDiscussions}`);
  lines.push(`- **Resolved:** ${report.summary.resolved}`);
  lines.push(`- **Escalated to Head:** ${report.summary.escalated}`);
  lines.push('');

  lines.push('## Resolved Discussions');
  lines.push('');

  const resolved = report.discussions.filter((d) => d.consensusReached);
  for (const verdict of resolved) {
    lines.push(`### ${verdict.discussionId} - ${verdict.finalSeverity}`);
    lines.push('');
    lines.push(verdict.reasoning);
    lines.push('');
  }

  lines.push('## Escalated to Head');
  lines.push('');

  const escalated = report.discussions.filter((d) => !d.consensusReached);
  for (const verdict of escalated) {
    lines.push(`### ${verdict.discussionId} - ${verdict.finalSeverity}`);
    lines.push('');
    lines.push(verdict.reasoning);
    lines.push('');
  }

  lines.push('## Unconfirmed Issues');
  lines.push('');
  lines.push(`${report.unconfirmedIssues.length} issue(s) flagged by single reviewer.`);
  lines.push('');

  lines.push('## Suggestions');
  lines.push('');
  lines.push(`${report.suggestions.length} low-priority suggestion(s).`);
  lines.push('');

  return lines.join('\n');
}
