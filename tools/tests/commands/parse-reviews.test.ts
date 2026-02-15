/**
 * Parse-reviews command tests
 * Wrapper around parser utilities
 */

import { describe, it, expect } from 'vitest';
import { parseReviews } from '../../src/commands/parse-reviews.js';

describe('parse-reviews command', () => {
  it('should parse valid reviews', () => {
    const input = JSON.stringify({
      reviews: [
        {
          reviewer: 'r1',
          file: 'test.ts',
          response: '[critical] Security | L10 | SQL Injection\nConfidence: 0.9',
        },
      ],
    });

    const output = parseReviews(input);
    const result = JSON.parse(output);

    expect(result.parsedReviews).toHaveLength(1);
    expect(result.parsedReviews[0].reviewer).toBe('r1');
    expect(result.parsedReviews[0].file).toBe('test.ts');
    expect(result.parsedReviews[0].issues).toHaveLength(1);
    expect(result.parsedReviews[0].issues[0].severity).toBe('critical');
  });

  it('should handle multiple reviewers', () => {
    const input = JSON.stringify({
      reviews: [
        {
          reviewer: 'r1',
          file: 'auth.ts',
          response: '[critical] Security | L10 | Issue 1',
        },
        {
          reviewer: 'r2',
          file: 'auth.ts',
          response: '[warning] Performance | L20 | Issue 2',
        },
      ],
    });

    const output = parseReviews(input);
    const result = JSON.parse(output);

    expect(result.parsedReviews).toHaveLength(2);
    expect(result.parsedReviews[0].reviewer).toBe('r1');
    expect(result.parsedReviews[1].reviewer).toBe('r2');
  });

  it('should preserve parse failures', () => {
    const input = JSON.stringify({
      reviews: [
        {
          reviewer: 'r1',
          file: 'test.ts',
          response: 'Invalid response without structured blocks',
        },
      ],
    });

    const output = parseReviews(input);
    const result = JSON.parse(output);

    expect(result.parsedReviews[0].issues).toHaveLength(0);
    expect(result.parsedReviews[0].parseFailures).toHaveLength(1);
  });

  it('should handle empty reviews array', () => {
    const input = JSON.stringify({ reviews: [] });

    const output = parseReviews(input);
    const result = JSON.parse(output);

    expect(result.parsedReviews).toHaveLength(0);
  });

  it('should handle invalid JSON gracefully', () => {
    const output = parseReviews('not valid json');
    const result = JSON.parse(output);

    expect(result).toHaveProperty('error');
  });

  it('should validate input schema', () => {
    const input = JSON.stringify({
      // Missing 'reviews' field
      wrong_field: [],
    });

    const output = parseReviews(input);
    const result = JSON.parse(output);

    expect(result).toHaveProperty('error');
  });

  it('should handle mixed success and failure', () => {
    const input = JSON.stringify({
      reviews: [
        {
          reviewer: 'r1',
          file: 'test.ts',
          response: '[critical] Security | L10 | Valid issue',
        },
        {
          reviewer: 'r2',
          file: 'test.ts',
          response: 'No structured content',
        },
      ],
    });

    const output = parseReviews(input);
    const result = JSON.parse(output);

    expect(result.parsedReviews).toHaveLength(2);
    expect(result.parsedReviews[0].issues).toHaveLength(1);
    expect(result.parsedReviews[1].parseFailures).toHaveLength(1);
  });

  describe('Gemini JSON wrapper extraction', () => {
    it('should extract content from Gemini JSON wrapper', () => {
      const geminiResponse = JSON.stringify({
        session_id: 'test-session-123',
        response: '[critical] Security | L10 | SQL Injection\nConfidence: 0.95',
        stats: {
          models: {
            'gemini-2.5-flash': {
              tokens: { total: 100 }
            }
          }
        }
      });

      const input = JSON.stringify({
        reviews: [
          {
            reviewer: 'gemini-1',
            file: 'test.ts',
            response: geminiResponse,
          },
        ],
      });

      const output = parseReviews(input);
      const result = JSON.parse(output);

      // Should successfully extract and parse the wrapped content
      expect(result.parsedReviews).toHaveLength(1);
      expect(result.parsedReviews[0].issues).toHaveLength(1);
      expect(result.parsedReviews[0].issues[0].severity).toBe('critical');
      expect(result.parsedReviews[0].issues[0].title).toBe('SQL Injection');
      expect(result.parsedReviews[0].parseFailures).toHaveLength(0);
    });

    it('should handle plain text input (non-Gemini format)', () => {
      const input = JSON.stringify({
        reviews: [
          {
            reviewer: 'kimi-1',
            file: 'test.ts',
            response: '[warning] Performance | L20 | Slow query\nConfidence: 0.8',
          },
        ],
      });

      const output = parseReviews(input);
      const result = JSON.parse(output);

      // Should parse plain text normally (existing behavior)
      expect(result.parsedReviews).toHaveLength(1);
      expect(result.parsedReviews[0].issues).toHaveLength(1);
      expect(result.parsedReviews[0].issues[0].severity).toBe('warning');
      expect(result.parsedReviews[0].parseFailures).toHaveLength(0);
    });

    it('should use original text as fallback for invalid JSON', () => {
      const input = JSON.stringify({
        reviews: [
          {
            reviewer: 'broken-json',
            file: 'test.ts',
            response: '{ invalid json }',
          },
        ],
      });

      const output = parseReviews(input);
      const result = JSON.parse(output);

      // Should treat as plain text (parse failure expected)
      expect(result.parsedReviews).toHaveLength(1);
      expect(result.parsedReviews[0].issues).toHaveLength(0);
      expect(result.parsedReviews[0].parseFailures).toHaveLength(1);
    });
  });
});
