import type { DiscordEmbed } from './types.js';
import type { SynthesisResult } from '../head/synthesizer.js';
import type { DebateResult } from '../debate/types.js';
import type { SupporterExecutionResult } from '../supporter/types.js';
import type { ReviewIssue, Severity } from '../parser/schema.js';

/**
 * Discord color palette for severity levels
 */
const SEVERITY_COLORS: Record<Severity, number> = {
  CRITICAL: 0xdc2626, // red-600
  MAJOR: 0xea580c, // orange-600
  MINOR: 0xfbbf24, // yellow-400
  SUGGESTION: 0x3b82f6, // blue-500
};

/**
 * Discord embed limits
 * https://discord.com/developers/docs/resources/channel#embed-object-embed-limits
 */
const DISCORD_LIMITS = {
  EMBED_DESCRIPTION: 4096,
  FIELD_NAME: 256,
  FIELD_VALUE: 1024,
} as const;

/**
 * Truncate text to fit Discord limits
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format a complete review summary as a Discord embed
 */
export function formatReviewSummary(
  file: string,
  synthesis: SynthesisResult
): DiscordEmbed {
  const { issues, bySeverity, totalIssues } = synthesis;
  const stats = {
    total: totalIssues,
    critical: bySeverity.CRITICAL,
    major: bySeverity.MAJOR,
    minor: bySeverity.MINOR,
    suggestion: bySeverity.SUGGESTION,
  };

  // Build description with stats
  const description = truncate(
    [
      `**File**: \`${file}\``,
      `**Total Issues**: ${stats.total}`,
      `**By Severity**: CRITICAL: ${stats.critical}, MAJOR: ${stats.major}, MINOR: ${stats.minor}, SUGGESTION: ${stats.suggestion}`,
    ].join('\n'),
    DISCORD_LIMITS.EMBED_DESCRIPTION
  );

  // Build fields for each issue
  const fields = issues.slice(0, 25).map((issue) => {
    const issueDescription = issue.description || '';
    const fieldName = truncate(
      `[${issue.agreedSeverity}] ${issue.category}`,
      DISCORD_LIMITS.FIELD_NAME
    );
    const fieldValue = truncate(
      `**Line ${issue.line}**: ${issue.title}\n${issueDescription}`,
      DISCORD_LIMITS.FIELD_VALUE
    );
    return {
      name: fieldName,
      value: fieldValue,
      inline: false,
    };
  });

  // Determine embed color based on highest severity
  let color = SEVERITY_COLORS.SUGGESTION;
  if (stats.critical > 0) color = SEVERITY_COLORS.CRITICAL;
  else if (stats.major > 0) color = SEVERITY_COLORS.MAJOR;
  else if (stats.minor > 0) color = SEVERITY_COLORS.MINOR;

  return {
    title: `🔍 Code Review: ${file}`,
    description,
    color,
    fields: fields.length > 0 ? fields : undefined,
    footer: {
      text: `Reviewed by ${issues[0]?.reviewers.length || 0} reviewer(s)`,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format a debate result as a Discord embed
 */
export function formatDebateResult(debate: DebateResult): DiscordEmbed {
  const { issue, consensus, participants } = debate;

  const description = truncate(
    [
      `**Location**: \`${issue.file}:${issue.line}\``,
      `**Category**: ${issue.category}`,
      `**Consensus**: ${consensus}`,
      `**Rounds**: ${debate.rounds}`,
    ].join('\n'),
    DISCORD_LIMITS.EMBED_DESCRIPTION
  );

  const fields = participants.slice(0, 5).map((participant) => ({
    name: participant.reviewer,
    value: `${participant.rounds.length} round(s)`,
    inline: true,
  }));

  const color =
    consensus === 'strong'
      ? 0x10b981 // green-500
      : consensus === 'majority'
        ? 0xfbbf24 // yellow-400
        : 0xef4444; // red-500

  return {
    title: `🗣️ Debate: ${issue.category}`,
    description,
    color,
    fields,
    footer: {
      text: `Final verdict: ${debate.finalSeverity}`,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format a single issue as a Discord embed
 */
export function formatIssue(issue: ReviewIssue): DiscordEmbed {
  return {
    title: `[${issue.severity}] ${issue.title}`,
    description: issue.description,
    color: SEVERITY_COLORS[issue.severity],
    fields: [
      {
        name: 'Category',
        value: issue.category,
        inline: true,
      },
      {
        name: 'Line',
        value: issue.line.toString(),
        inline: true,
      },
      {
        name: 'Confidence',
        value: `${(issue.confidence * 100).toFixed(0)}%`,
        inline: true,
      },
    ],
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format supporter validation results
 */
export function formatSupporterResults(
  results: SupporterExecutionResult[]
): DiscordEmbed {
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  const description = [
    `**Total Supporters**: ${results.length}`,
    `**Successful**: ${successful.length}`,
    `**Failed**: ${failed.length}`,
  ].join('\n');

  const fields = successful.map((result) => ({
    name: `✅ ${result.supporter}`,
    value: 'Completed successfully',
    inline: true,
  }));

  if (failed.length > 0) {
    fields.push(
      ...failed.map((result) => ({
        name: `❌ ${result.supporter}`,
        value: `Error: ${result.error || 'Unknown'}`,
        inline: true,
      }))
    );
  }

  return {
    title: '🛡️ Supporter Validation',
    description,
    color: failed.length > 0 ? 0xfbbf24 : 0x10b981,
    fields,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format review statistics as a simple text summary
 */
export function formatStatsText(stats: {
  critical: number;
  major: number;
  minor: number;
  suggestion: number;
  total: number;
}): string {
  return [
    '📊 **Review Statistics**',
    `- CRITICAL: ${stats.critical}`,
    `- MAJOR: ${stats.major}`,
    `- MINOR: ${stats.minor}`,
    `- SUGGESTION: ${stats.suggestion}`,
    `**Total**: ${stats.total}`,
  ].join('\n');
}
