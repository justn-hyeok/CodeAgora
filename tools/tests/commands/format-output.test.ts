/**
 * Format-output command tests
 * Markdown report generation
 */

import { describe, it, expect } from 'vitest';
import { formatOutput } from '../../src/commands/format-output.js';

describe('format-output command', () => {
  it('should generate markdown with consensus issues', () => {
    const input = JSON.stringify({
      consensusIssues: [
        {
          issueGroup: { file: 'test.ts', line: 10, title: 'SQL Injection' },
          agreedSeverity: 'critical',
          confidence: 0.85,
          debateRequired: false,
          voters: ['r1', 'r2', 'r3'],
        },
      ],
      debateIssues: [],
      debateResults: [],
    });

    const output = formatOutput(input);
    const result = JSON.parse(output);

    expect(result.markdown).toContain('# Code Review Report');
    expect(result.markdown).toContain('Consensus Issues');
    expect(result.markdown).toContain('SQL Injection');
    expect(result.markdown).toContain('test.ts:10');
    expect(result.summary.totalIssues).toBe(1);
  });

  it('should group issues by severity', () => {
    const input = JSON.stringify({
      consensusIssues: [
        {
          issueGroup: { file: 'test.ts', line: 10, title: 'Critical Issue' },
          agreedSeverity: 'critical',
          confidence: 0.9,
          debateRequired: false,
          voters: ['r1'],
        },
        {
          issueGroup: { file: 'test.ts', line: 20, title: 'Warning Issue' },
          agreedSeverity: 'warning',
          confidence: 0.8,
          debateRequired: false,
          voters: ['r1'],
        },
      ],
      debateIssues: [],
      debateResults: [],
    });

    const output = formatOutput(input);
    const result = JSON.parse(output);

    expect(result.markdown).toContain('CRITICAL');
    expect(result.markdown).toContain('WARNING');
    expect(result.summary.bySeverity.critical).toBe(1);
    expect(result.summary.bySeverity.warning).toBe(1);
  });

  it('should include debate results', () => {
    const input = JSON.stringify({
      consensusIssues: [],
      debateIssues: [],
      debateResults: [
        {
          issueGroup: { file: 'test.ts', line: 30, title: 'Debated Issue' },
          finalSeverity: 'warning',
          rounds: 3,
          finalReasoning: 'After 3 rounds, we concluded this is a warning',
        },
      ],
    });

    const output = formatOutput(input);
    const result = JSON.parse(output);

    expect(result.markdown).toContain('Debated Issues');
    expect(result.markdown).toContain('Debated Issue');
    expect(result.markdown).toContain('**Rounds:** 3');
    expect(result.summary.debatesHeld).toBe(1);
  });

  it('should handle empty input', () => {
    const input = JSON.stringify({
      consensusIssues: [],
      debateIssues: [],
      debateResults: [],
    });

    const output = formatOutput(input);
    const result = JSON.parse(output);

    expect(result.markdown).toContain('# Code Review Report');
    expect(result.summary.totalIssues).toBe(0);
  });

  it('should include severity emojis', () => {
    const input = JSON.stringify({
      consensusIssues: [
        {
          issueGroup: { file: 'test.ts', line: 10, title: 'Issue' },
          agreedSeverity: 'critical',
          confidence: 0.9,
          debateRequired: false,
          voters: ['r1'],
        },
      ],
      debateIssues: [],
      debateResults: [],
    });

    const output = formatOutput(input);
    const result = JSON.parse(output);

    expect(result.markdown).toContain('🔴'); // Critical emoji
  });

  it('should show confidence and reviewer count', () => {
    const input = JSON.stringify({
      consensusIssues: [
        {
          issueGroup: { file: 'test.ts', line: 10, title: 'Issue' },
          agreedSeverity: 'warning',
          confidence: 0.75,
          debateRequired: false,
          voters: ['r1', 'r2', 'r3'],
        },
      ],
      debateIssues: [],
      debateResults: [],
    });

    const output = formatOutput(input);
    const result = JSON.parse(output);

    expect(result.markdown).toContain('75%'); // Confidence
    expect(result.markdown).toContain('3 reviewers');
  });

  it('should handle large number of issues', () => {
    const issues = Array.from({ length: 20 }, (_, i) => ({
      issueGroup: { file: 'test.ts', line: i * 10, title: `Issue ${i}` },
      agreedSeverity: i % 2 === 0 ? 'critical' : 'warning',
      confidence: 0.8,
      debateRequired: false,
      voters: ['r1'],
    }));

    const input = JSON.stringify({
      consensusIssues: issues,
      debateIssues: [],
      debateResults: [],
    });

    const output = formatOutput(input);
    const result = JSON.parse(output);

    expect(result.summary.totalIssues).toBe(20);
    expect(result.markdown).toContain('Issue 0');
    expect(result.markdown).toContain('Issue 19');
  });

  it('should include suggestions if present', () => {
    const input = JSON.stringify({
      consensusIssues: [
        {
          issueGroup: { file: 'test.ts', line: 10, title: 'Issue' },
          agreedSeverity: 'warning',
          confidence: 0.8,
          debateRequired: false,
          voters: ['r1'],
          suggestions: ['Use async/await', 'Add error handling'],
        },
      ],
      debateIssues: [],
      debateResults: [],
    });

    const output = formatOutput(input);
    const result = JSON.parse(output);

    expect(result.markdown).toContain('Suggestions');
    expect(result.markdown).toContain('Use async/await');
    expect(result.markdown).toContain('Add error handling');
  });

  it('should validate output schema', () => {
    const input = JSON.stringify({
      consensusIssues: [],
      debateIssues: [],
      debateResults: [],
    });

    const output = formatOutput(input);
    const result = JSON.parse(output);

    expect(result).toHaveProperty('markdown');
    expect(result).toHaveProperty('summary');
    expect(result.summary).toHaveProperty('totalIssues');
    expect(result.summary).toHaveProperty('bySeverity');
    expect(result.summary).toHaveProperty('debatesHeld');
    expect(typeof result.markdown).toBe('string');
    expect(typeof result.summary.totalIssues).toBe('number');
  });

  it('should handle invalid JSON gracefully', () => {
    const output = formatOutput('not valid json');
    const result = JSON.parse(output);

    expect(result).toHaveProperty('error');
  });
});
