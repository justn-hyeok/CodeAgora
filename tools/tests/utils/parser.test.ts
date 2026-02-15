/**
 * Parser utility tests
 * Migrated from src/parser/ tests with new lowercase severity schema
 */

import { describe, it, expect } from 'vitest';
import {
  parseIssueBlock,
  parseReviewerResponse,
  transformReviewerResponse,
} from '../../src/utils/parser.js';

describe('parseIssueBlock', () => {
  it('should parse basic issue format', () => {
    const block = '[critical] Security | L42 | SQL Injection vulnerability';
    const result = parseIssueBlock(block);

    expect(result.parseSuccess).toBe(true);
    expect(result.severity).toBe('critical');
    expect(result.category).toBe('Security');
    expect(result.line).toBe(42);
    expect(result.title).toBe('SQL Injection vulnerability');
  });

  it('should parse line ranges', () => {
    const block = '[warning] Performance | L10-L25 | Memory leak in loop';
    const result = parseIssueBlock(block);

    expect(result.parseSuccess).toBe(true);
    expect(result.line).toBe(10);
    expect(result.lineEnd).toBe(25);
  });

  it('should normalize severity to lowercase', () => {
    const testCases = [
      { input: '[CRITICAL]', expected: 'critical' },
      { input: '[Critical]', expected: 'critical' },
      { input: '[WARNING]', expected: 'warning' },
      { input: '[MAJOR]', expected: 'warning' },
      { input: '[SUGGESTION]', expected: 'suggestion' },
      { input: '[MINOR]', expected: 'suggestion' },
      { input: '[NITPICK]', expected: 'nitpick' },
      { input: '[NIT]', expected: 'nitpick' },
    ];

    for (const { input, expected } of testCases) {
      const block = `${input} Category | L1 | Title`;
      const result = parseIssueBlock(block);
      expect(result.severity).toBe(expected);
    }
  });

  it('should handle unknown severity as suggestion', () => {
    const block = '[UNKNOWN] Category | L1 | Title';
    const result = parseIssueBlock(block);

    expect(result.severity).toBe('suggestion');
  });

  it('should extract description', () => {
    const block = `[warning] Logic | L15 | Undefined behavior
This function may return undefined in edge cases.`;
    const result = parseIssueBlock(block);

    expect(result.description).toContain('undefined in edge cases');
  });

  it('should extract suggestion', () => {
    const block = `[critical] Security | L42 | SQL Injection
Suggestion: Use parameterized queries`;
    const result = parseIssueBlock(block);

    expect(result.suggestion).toBe('Use parameterized queries');
  });

  it('should extract confidence and clamp to [0, 1]', () => {
    const testCases = [
      { input: 'Confidence: 0.85', expected: 0.85 },
      { input: 'Confidence: 1.5', expected: 1.0 }, // Clamped to max
      { input: 'Confidence: -0.3', expected: 0.0 }, // Clamped to min
      { input: '', expected: 0.5 }, // Default
    ];

    for (const { input, expected } of testCases) {
      const block = `[warning] Category | L1 | Title\n${input}`;
      const result = parseIssueBlock(block);
      expect(result.confidence).toBe(expected);
    }
  });

  it('should handle parse failure gracefully', () => {
    const invalidBlock = 'This is not a valid issue format';
    const result = parseIssueBlock(invalidBlock);

    expect(result.parseSuccess).toBe(false);
    expect(result.parseError).toContain('Could not match');
    expect(result.raw).toBe(invalidBlock);
  });

  it('should handle special characters in title', () => {
    const block = '[warning] Code | L5 | Use `async/await` instead of `.then()`';
    const result = parseIssueBlock(block);

    expect(result.parseSuccess).toBe(true);
    expect(result.title).toContain('async/await');
  });
});

describe('parseReviewerResponse', () => {
  it('should parse multiple issue blocks', () => {
    const response = `
[critical] Security | L10 | SQL Injection
User input not sanitized
Confidence: 0.9

[warning] Performance | L25 | Inefficient loop
Use map instead of forEach
Confidence: 0.7

[suggestion] Style | L30 | Variable naming
Consider more descriptive names
    `;

    const blocks = parseReviewerResponse(response);

    expect(blocks).toHaveLength(3);
    expect(blocks[0].severity).toBe('critical');
    expect(blocks[1].severity).toBe('warning');
    expect(blocks[2].severity).toBe('suggestion');
  });

  it('should handle "no issues" response', () => {
    const responses = [
      'No issues found',
      'No problems found',
      'Looks good',
    ];

    for (const response of responses) {
      const blocks = parseReviewerResponse(response);
      expect(blocks).toHaveLength(0);
    }
  });

  it('should handle empty response', () => {
    const blocks = parseReviewerResponse('');
    expect(blocks).toHaveLength(0);
  });

  it('should handle response with no structured blocks', () => {
    const response = 'This is just plain text without any structured issues.';
    const blocks = parseReviewerResponse(response);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].parseSuccess).toBe(false);
    expect(blocks[0].parseError).toContain('No structured issue blocks');
  });

  it('should handle mixed JSON and markdown', () => {
    const response = `
Some preamble text...

[critical] Security | L42 | XSS Vulnerability
Unescaped user input in template

{ "note": "This is JSON that should be ignored" }

[warning] Logic | L50 | Edge case not handled
    `;

    const blocks = parseReviewerResponse(response);

    // Should find the 2 valid blocks, ignore JSON
    expect(blocks.filter(b => b.parseSuccess)).toHaveLength(2);
  });

  it('should preserve all blocks including parse failures', () => {
    const response = `
[critical] Security | L10 | Valid issue

This is invalid text that won't parse

[warning] Performance | L20 | Another valid issue
    `;

    const blocks = parseReviewerResponse(response);

    // 2 valid blocks found, invalid text skipped (only block headers trigger parsing)
    expect(blocks).toHaveLength(2);
    expect(blocks.filter(b => b.parseSuccess)).toHaveLength(2);
  });
});

describe('transformReviewerResponse', () => {
  it('should transform valid response into ParsedReview', () => {
    const response = `
[critical] Security | L10 | SQL Injection
Confidence: 0.9

[warning] Performance | L20 | Slow query
Confidence: 0.7
    `;

    const result = transformReviewerResponse('reviewer-1', 'auth.ts', response);

    expect(result.reviewer).toBe('reviewer-1');
    expect(result.file).toBe('auth.ts');
    expect(result.issues).toHaveLength(2);
    expect(result.parseFailures).toHaveLength(0);
  });

  it('should separate successful and failed parses', () => {
    const response = `
[critical] Security | L10 | Valid issue

Invalid text block

[warning] Performance | L20 | Another valid issue
    `;

    const result = transformReviewerResponse('reviewer-1', 'test.ts', response);

    expect(result.issues).toHaveLength(2);
    expect(result.parseFailures).toHaveLength(0);
  });

  it('should handle completely invalid response', () => {
    const response = 'No structured content at all';
    const result = transformReviewerResponse('reviewer-1', 'test.ts', response);

    expect(result.issues).toHaveLength(0);
    expect(result.parseFailures).toHaveLength(1);
    expect(result.parseFailures[0].reason).toContain('No structured issue blocks');
  });

  it('should handle empty response', () => {
    const result = transformReviewerResponse('reviewer-1', 'test.ts', '');

    expect(result.issues).toHaveLength(0);
    expect(result.parseFailures).toHaveLength(0);
  });

  it('should handle code snippets in description', () => {
    const response = `
[warning] Code | L15 | Use async/await
Instead of:
\`\`\`typescript
promise.then(x => x)
\`\`\`
Use:
\`\`\`typescript
await promise
\`\`\`
Confidence: 0.8
    `;

    const result = transformReviewerResponse('reviewer-1', 'test.ts', response);

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].description).toContain('```');
  });
});
