/**
 * Review Output Formatters
 * Pure functions for formatting PipelineResult into various output formats.
 */

import type { PipelineResult } from '../../pipeline/orchestrator.js';

export type OutputFormat = 'text' | 'json' | 'md' | 'github';

// Severity order for display grouping
const SEVERITY_ORDER = ['critical', 'error', 'warning', 'info', 'minor'] as const;

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
    return lines.join('\n');
  }

  lines.push('Review complete!');
  lines.push(`  Session: ${result.date}/${result.sessionId}`);
  lines.push(`  Output: .ca/sessions/${result.date}/${result.sessionId}/`);

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
  lines.push('Review completed successfully.');
  lines.push('');
  lines.push(`See full report: \`.ca/sessions/${result.date}/${result.sessionId}/\``);

  return lines.join('\n');
}

// ============================================================================
// GitHub format (checkbox + emoji style)
// ============================================================================

const SEVERITY_EMOJI: Record<string, string> = {
  critical: '🔴',
  error: '🟠',
  warning: '🟡',
  info: '🔵',
  minor: '⚪',
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

  // Placeholder severity groups for future expansion when PipelineResult carries issues
  for (const severity of SEVERITY_ORDER) {
    const emoji = SEVERITY_EMOJI[severity] ?? '⚪';
    lines.push(`### ${emoji} ${severity.toUpperCase()} (0)`);
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
