/**
 * Review Output Formatters
 * Pure functions for formatting PipelineResult into various output formats.
 */

import type { PipelineResult } from '../../pipeline/orchestrator.js';
import { SEVERITY_ORDER } from '../../types/core.js';
import { severityColor, decisionColor, dim, bold } from '../utils/colors.js';

export type OutputFormat = 'text' | 'json' | 'md' | 'github';

// ============================================================================
// Text format (default)
// ============================================================================

/**
 * Format a PipelineResult as plain text output.
 */
export function formatText(result: PipelineResult): string {
  const lines: string[] = [];

  if (result.status === 'error') {
    lines.push(`Review failed: ${result.error ?? 'unknown error'}`);
    lines.push(dim(`  Session: ${result.date}/${result.sessionId}`));
    return lines.join('\n');
  }

  if (!result.summary) {
    // Fallback: no summary available
    lines.push('Review complete!');
    lines.push(`  Session: ${result.date}/${result.sessionId}`);
    lines.push(`  Output: .ca/sessions/${result.date}/${result.sessionId}/`);
    return lines.join('\n');
  }

  const s = result.summary;

  // Decision header
  const colorFn = decisionColor[s.decision] ?? bold;
  lines.push(`${colorFn(s.decision)}  ${dim(s.reasoning)}`);
  lines.push('');

  // Severity summary line
  const severityParts = SEVERITY_ORDER
    .filter((sev) => (s.severityCounts[sev] ?? 0) > 0)
    .map((sev) => {
      const fn = severityColor[sev] ?? ((x: string) => x);
      return fn(`${sev}: ${s.severityCounts[sev]}`);
    });
  if (severityParts.length > 0) {
    lines.push(severityParts.join('  '));
    lines.push('');
  }

  // Top issues (up to 5)
  if (s.topIssues.length > 0) {
    lines.push(bold('Top Issues:'));
    for (const issue of s.topIssues.slice(0, 5)) {
      const fn = severityColor[issue.severity as keyof typeof severityColor] ?? ((x: string) => x);
      const sev = fn(issue.severity.padEnd(16));
      const loc = dim(`${issue.filePath}:${issue.lineRange[0]}`);
      lines.push(`  ${sev}  ${loc}  ${issue.title}`);
    }
    lines.push('');
  }

  // Discussion summary
  if (s.totalDiscussions > 0) {
    lines.push(
      dim(
        `Discussions: ${s.totalDiscussions} total, ${s.resolved} resolved, ${s.escalated} escalated`
      )
    );
  }

  // Session reference
  lines.push(dim(`Session: ${result.date}/${result.sessionId}`));

  return lines.join('\n');
}

// ============================================================================
// JSON format
// ============================================================================

/**
 * Format a PipelineResult as JSON.
 */
export function formatJson(result: PipelineResult): string {
  return JSON.stringify(result, null, 2);
}

// ============================================================================
// Markdown format (PR comment style)
// ============================================================================

/**
 * Format a PipelineResult as Markdown suitable for PR comments.
 */
export function formatMarkdown(result: PipelineResult): string {
  const lines: string[] = [];

  lines.push('## CodeAgora Review');
  lines.push('');

  if (result.status === 'error') {
    lines.push(`**Error:** ${result.error ?? 'unknown error'}`);
    return lines.join('\n');
  }

  lines.push(`**Session:** ${result.date}/${result.sessionId}`);
  lines.push('');

  if (result.summary) {
    const s = result.summary;

    // Decision
    lines.push(`**Decision:** ${s.decision}`);
    lines.push('');
    lines.push(`> ${s.reasoning}`);
    lines.push('');

    // Severity table
    const tableRows = SEVERITY_ORDER
      .map((sev) => `| ${sev} | ${s.severityCounts[sev] ?? 0} |`)
      .join('\n');
    lines.push('| Severity | Count |');
    lines.push('|----------|-------|');
    lines.push(tableRows);
    lines.push('');

    // Top issues
    if (s.topIssues.length > 0) {
      lines.push('**Top Issues:**');
      for (const issue of s.topIssues.slice(0, 5)) {
        lines.push(
          `- **[${issue.severity}]** \`${issue.filePath}:${issue.lineRange[0]}\` — ${issue.title}`
        );
      }
      lines.push('');
    }
  } else {
    lines.push('Review completed successfully.');
    lines.push('');
  }

  lines.push(`See full report: \`.ca/sessions/${result.date}/${result.sessionId}/\``);

  return lines.join('\n');
}

// ============================================================================
// GitHub format (checkbox + emoji style)
// ============================================================================

const SEVERITY_GITHUB: Record<string, { emoji: string; label: string }> = {
  HARSHLY_CRITICAL: { emoji: '🔴', label: 'Critical' },
  CRITICAL: { emoji: '🟠', label: 'Error' },
  WARNING: { emoji: '🟡', label: 'Warning' },
  SUGGESTION: { emoji: '🔵', label: 'Info' },
};

/**
 * Format a PipelineResult as GitHub-flavored Markdown with checkboxes and emojis.
 */
export function formatGithub(result: PipelineResult): string {
  const lines: string[] = [];

  lines.push('## 🔍 CodeAgora Review');
  lines.push('');

  if (result.status === 'error') {
    lines.push(`❌ **Error:** ${result.error ?? 'unknown error'}`);
    return lines.join('\n');
  }

  lines.push(`✅ **Review completed** — Session \`${result.date}/${result.sessionId}\``);
  lines.push('');

  // Severity groups with actual counts from summary
  for (const severity of SEVERITY_ORDER) {
    const count = result.summary?.severityCounts[severity] ?? 0;
    const { emoji, label } = SEVERITY_GITHUB[severity] ?? { emoji: '⚪', label: severity };
    lines.push(`### ${emoji} **${label}** / ${severity} (${count})`);
    lines.push('');
  }

  lines.push(`> Full report: \`.ca/sessions/${result.date}/${result.sessionId}/\``);

  return lines.join('\n');
}

// ============================================================================
// Unified dispatcher
// ============================================================================

/**
 * Format a PipelineResult using the requested output format.
 */
export function formatOutput(result: PipelineResult, format: OutputFormat): string {
  switch (format) {
    case 'text':
      return formatText(result);
    case 'json':
      return formatJson(result);
    case 'md':
      return formatMarkdown(result);
    case 'github':
      return formatGithub(result);
    default: {
      // Exhaustive check — TypeScript will warn if a case is missing
      const _exhaustive: never = format;
      return formatText(_exhaustive);
    }
  }
}
