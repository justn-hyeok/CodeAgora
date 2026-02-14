import chalk from 'chalk';
import type { SynthesisResult, SynthesizedIssue } from './synthesizer.js';
import type { DebateDecision } from '../debate/judge.js';
import type { DebateResult } from '../debate/types.js';
import type { SupporterExecutionResult } from '../supporter/types.js';
import type { Severity } from '../parser/schema.js';

function getSeverityColor(severity: Severity): (text: string) => string {
  switch (severity) {
    case 'CRITICAL':
      return chalk.red.bold;
    case 'MAJOR':
      return chalk.yellow.bold;
    case 'MINOR':
      return chalk.blue;
    case 'SUGGESTION':
      return chalk.gray;
  }
}

function formatIssue(issue: SynthesizedIssue): string {
  const color = getSeverityColor(issue.agreedSeverity);
  const lineRange = issue.lineEnd ? `L${issue.line}-${issue.lineEnd}` : `L${issue.line}`;

  let output = color(`[${issue.agreedSeverity}]`) + ` ${issue.category} | ${lineRange} | ${issue.title}\n`;

  if (issue.description) {
    output += chalk.gray(`  ${issue.description}\n`);
  }

  if (issue.suggestion) {
    output += chalk.green(`  💡 ${issue.suggestion}\n`);
  }

  output += chalk.dim(`  👥 ${issue.reviewers.join(', ')} (confidence: ${(issue.confidence * 100).toFixed(0)}%)\n`);

  return output;
}

export function generateMarkdownReport(
  file: string,
  synthesis: SynthesisResult,
  debate: DebateDecision,
  metrics: {
    totalReviewers: number;
    successfulReviewers: number;
    duration: number;
  }
): string {
  let report = '';

  report += `# Code Review Report\n\n`;
  report += `**File:** ${file}\n\n`;

  // Summary
  report += `## Summary\n\n`;
  report += `- Total Issues: ${synthesis.totalIssues}\n`;
  report += `- Critical: ${synthesis.bySeverity.CRITICAL}\n`;
  report += `- Major: ${synthesis.bySeverity.MAJOR}\n`;
  report += `- Minor: ${synthesis.bySeverity.MINOR}\n`;
  report += `- Suggestions: ${synthesis.bySeverity.SUGGESTION}\n`;
  report += `- Debate Required: ${debate.required ? 'Yes' : 'No'}\n`;

  if (debate.required) {
    report += `  - Reason: ${debate.reason}\n`;
  }

  report += `\n`;

  // Issues by severity
  if (synthesis.bySeverity.CRITICAL > 0) {
    report += `## Critical Issues\n\n`;
    for (const issue of synthesis.issues.filter((i) => i.agreedSeverity === 'CRITICAL')) {
      report += `### [CRITICAL] ${issue.title}\n\n`;
      report += `**Line:** ${issue.lineEnd ? `${issue.line}-${issue.lineEnd}` : issue.line}\n`;
      report += `**Category:** ${issue.category}\n\n`;
      if (issue.description) report += `${issue.description}\n\n`;
      if (issue.suggestion) report += `**Suggestion:** ${issue.suggestion}\n\n`;
      report += `**Reviewers:** ${issue.reviewers.join(', ')}\n\n`;
    }
  }

  if (synthesis.bySeverity.MAJOR > 0) {
    report += `## Major Issues\n\n`;
    for (const issue of synthesis.issues.filter((i) => i.agreedSeverity === 'MAJOR')) {
      report += `- **${issue.title}** (L${issue.line}) - ${issue.reviewers.join(', ')}\n`;
    }
    report += `\n`;
  }

  // Metrics
  report += `## Metrics\n\n`;
  report += `- Reviewers: ${metrics.successfulReviewers}/${metrics.totalReviewers}\n`;
  report += `- Duration: ${(metrics.duration / 1000).toFixed(1)}s\n`;

  return report;
}

export function printTerminalReport(
  file: string,
  synthesis: SynthesisResult,
  debate: DebateDecision,
  metrics: {
    totalReviewers: number;
    successfulReviewers: number;
    duration: number;
    debateResults?: DebateResult[];
    supporterResults?: SupporterExecutionResult[];
  }
): void {
  console.log(chalk.blue.bold('\n🔍 Oh My CodeReview\n'));
  console.log(chalk.gray(`File: ${file}\n`));

  // Summary
  console.log(chalk.bold('Summary:'));
  console.log(`  Total Issues: ${synthesis.totalIssues}`);
  console.log(chalk.red(`  Critical: ${synthesis.bySeverity.CRITICAL}`));
  console.log(chalk.yellow(`  Major: ${synthesis.bySeverity.MAJOR}`));
  console.log(chalk.blue(`  Minor: ${synthesis.bySeverity.MINOR}`));
  console.log(chalk.gray(`  Suggestions: ${synthesis.bySeverity.SUGGESTION}`));

  if (debate.required) {
    console.log(chalk.yellow(`\n⚠️  Debate Required: ${debate.reason}`));
  }

  // Supporter results
  if (metrics.supporterResults && metrics.supporterResults.length > 0) {
    const successfulSupporters = metrics.supporterResults.filter((r) => r.success);
    console.log(
      chalk.gray(`\n🔧 Supporters: ${successfulSupporters.length}/${metrics.supporterResults.length} completed`)
    );
    for (const result of successfulSupporters) {
      const validated = result.results.filter((r) => r.validated).length;
      console.log(chalk.gray(`  - ${result.supporter}: ${validated}/${result.results.length} validated`));
    }
  }

  // Debate results
  if (metrics.debateResults && metrics.debateResults.length > 0) {
    console.log(chalk.yellow(`\n🗣️  Debates Conducted: ${metrics.debateResults.length}`));
    for (const result of metrics.debateResults) {
      console.log(
        chalk.gray(
          `  - ${result.issue.file}:${result.issue.line} (${result.consensus} after ${result.rounds} round(s))`
        )
      );
    }
  }

  console.log('');

  // Issues
  if (synthesis.totalIssues > 0) {
    console.log(chalk.bold('Issues:\n'));

    for (const issue of synthesis.issues) {
      console.log(formatIssue(issue));
    }
  } else {
    console.log(chalk.green('✅ No issues found!\n'));
  }

  // Metrics
  console.log(chalk.dim('Metrics:'));
  console.log(chalk.dim(`  Reviewers: ${metrics.successfulReviewers}/${metrics.totalReviewers}`));
  console.log(chalk.dim(`  Duration: ${(metrics.duration / 1000).toFixed(1)}s\n`));
}
