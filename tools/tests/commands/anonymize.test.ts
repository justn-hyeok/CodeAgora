/**
 * Anonymize command tests
 * Severity-based grouping with reviewer names removed
 */

import { describe, it, expect } from 'vitest';
import { anonymize } from '../../src/commands/anonymize.js';

describe('anonymize command', () => {
  it('should remove reviewer names', () => {
    const input = JSON.stringify({
      opinions: [
        { reviewer: 'alice', severity: 'critical', reasoning: 'Security issue' },
        { reviewer: 'bob', severity: 'critical', reasoning: 'Data leak risk' },
      ],
    });

    const output = anonymize(input);
    const result = JSON.parse(output);

    // Should not contain reviewer names
    expect(result.anonymized).not.toContain('alice');
    expect(result.anonymized).not.toContain('bob');
  });

  it('should group by severity', () => {
    const input = JSON.stringify({
      opinions: [
        { reviewer: 'r1', severity: 'critical', reasoning: 'Issue A' },
        { reviewer: 'r2', severity: 'warning', reasoning: 'Issue B' },
        { reviewer: 'r3', severity: 'critical', reasoning: 'Issue C' },
      ],
    });

    const output = anonymize(input);
    const result = JSON.parse(output);

    // Should contain severity group headers
    expect(result.anonymized).toContain('CRITICAL');
    expect(result.anonymized).toContain('WARNING');

    // Should show counts
    expect(result.anonymized).toContain('2 reviewers identified as CRITICAL');
    expect(result.anonymized).toContain('1 reviewer identified as WARNING');
  });

  it('should use singular form for single reviewer', () => {
    const input = JSON.stringify({
      opinions: [{ reviewer: 'r1', severity: 'warning', reasoning: 'Issue' }],
    });

    const output = anonymize(input);
    const result = JSON.parse(output);

    expect(result.anonymized).toContain('1 reviewer identified as WARNING');
  });

  it('should preserve reasoning text', () => {
    const input = JSON.stringify({
      opinions: [
        { reviewer: 'r1', severity: 'critical', reasoning: 'SQL injection vulnerability' },
        { reviewer: 'r2', severity: 'critical', reasoning: 'XSS attack vector' },
      ],
    });

    const output = anonymize(input);
    const result = JSON.parse(output);

    expect(result.anonymized).toContain('SQL injection vulnerability');
    expect(result.anonymized).toContain('XSS attack vector');
  });

  it('should handle empty opinions array', () => {
    const input = JSON.stringify({ opinions: [] });

    const output = anonymize(input);
    const result = JSON.parse(output);

    expect(result.anonymized).toBe('');
  });

  it('should handle case-insensitive severity', () => {
    const input = JSON.stringify({
      opinions: [
        { reviewer: 'r1', severity: 'CRITICAL', reasoning: 'Issue A' },
        { reviewer: 'r2', severity: 'Critical', reasoning: 'Issue B' },
        { reviewer: 'r3', severity: 'critical', reasoning: 'Issue C' },
      ],
    });

    const output = anonymize(input);
    const result = JSON.parse(output);

    // All should be grouped together
    expect(result.anonymized).toContain('3 reviewers identified as CRITICAL');
  });

  it('should number opinions within each severity group', () => {
    const input = JSON.stringify({
      opinions: [
        { reviewer: 'r1', severity: 'warning', reasoning: 'First issue' },
        { reviewer: 'r2', severity: 'warning', reasoning: 'Second issue' },
      ],
    });

    const output = anonymize(input);
    const result = JSON.parse(output);

    expect(result.anonymized).toContain('1. First issue');
    expect(result.anonymized).toContain('2. Second issue');
  });

  it('should handle multiple severity groups', () => {
    const input = JSON.stringify({
      opinions: [
        { reviewer: 'r1', severity: 'critical', reasoning: 'A' },
        { reviewer: 'r2', severity: 'warning', reasoning: 'B' },
        { reviewer: 'r3', severity: 'suggestion', reasoning: 'C' },
        { reviewer: 'r4', severity: 'nitpick', reasoning: 'D' },
      ],
    });

    const output = anonymize(input);
    const result = JSON.parse(output);

    expect(result.anonymized).toContain('CRITICAL');
    expect(result.anonymized).toContain('WARNING');
    expect(result.anonymized).toContain('SUGGESTION');
    expect(result.anonymized).toContain('NITPICK');
  });

  it('should handle invalid JSON gracefully', () => {
    const output = anonymize('not valid json');
    const result = JSON.parse(output);

    expect(result).toHaveProperty('error');
  });
});
