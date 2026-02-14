import { describe, it, expect } from 'vitest';
import { collectReviews, getSuccessfulReviews, getFailedReviews } from '../../src/reviewer/collector.js';
import type { ExecutionResult } from '../../src/reviewer/types.js';

describe('Review Collector', () => {
  describe('collectReviews', () => {
    it('should collect reviews from successful executions', () => {
      const executionResult: ExecutionResult = {
        executions: [
          {
            reviewer: 'reviewer1',
            status: 'success',
            response: `[MINOR] style | 10 | Style issue
Description here
suggestion: Fix it
confidence: 0.8`,
            duration: 1000,
          },
        ],
        successful: 1,
        failed: 0,
      };

      const results = collectReviews('test.ts', executionResult);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      if (results[0].success) {
        expect(results[0].review.reviewer).toBe('reviewer1');
        expect(results[0].review.issues).toHaveLength(1);
      }
    });

    it('should skip failed executions', () => {
      const executionResult: ExecutionResult = {
        executions: [
          {
            reviewer: 'reviewer1',
            status: 'failed',
            error: 'Timeout',
            duration: 5000,
          },
        ],
        successful: 0,
        failed: 1,
      };

      const results = collectReviews('test.ts', executionResult);

      expect(results).toHaveLength(0);
    });

    it('should handle mixed success and failure', () => {
      const executionResult: ExecutionResult = {
        executions: [
          {
            reviewer: 'reviewer1',
            status: 'success',
            response: `[MAJOR] logic | 20 | Logic error
Fix this bug
suggestion: Refactor
confidence: 0.9`,
            duration: 1500,
          },
          {
            reviewer: 'reviewer2',
            status: 'failed',
            error: 'Network error',
            duration: 3000,
          },
          {
            reviewer: 'reviewer3',
            status: 'success',
            response: `[MINOR] style | 30 | Style issue
Improve readability
suggestion: Add comments
confidence: 0.7`,
            duration: 1200,
          },
        ],
        successful: 2,
        failed: 1,
      };

      const results = collectReviews('test.ts', executionResult);

      expect(results).toHaveLength(2);
      expect(results.filter((r) => r.success)).toHaveLength(2);
    });

    it('should handle timeout status', () => {
      const executionResult: ExecutionResult = {
        executions: [
          {
            reviewer: 'slow-reviewer',
            status: 'timeout',
            error: 'Timeout after 300s',
            duration: 300000,
          },
        ],
        successful: 0,
        failed: 1,
      };

      const results = collectReviews('test.ts', executionResult);

      expect(results).toHaveLength(0);
    });
  });

  describe('getSuccessfulReviews', () => {
    it('should extract only successful reviews', () => {
      const parseResults = [
        {
          success: true as const,
          review: {
            reviewer: 'reviewer1',
            issues: [
              {
                severity: 'MINOR' as const,
                category: 'style',
                line: 10,
                title: 'Issue',
                description: 'Description',
                suggestion: 'Fix',
                confidence: 0.8,
              },
            ],
            parseFailures: [],
          },
        },
        {
          success: false as const,
          error: 'Parse failed',
        },
      ];

      const successful = getSuccessfulReviews(parseResults);

      expect(successful).toHaveLength(1);
      expect(successful[0].reviewer).toBe('reviewer1');
    });

    it('should return empty array when all fail', () => {
      const parseResults = [
        {
          success: false as const,
          error: 'Parse failed 1',
        },
        {
          success: false as const,
          error: 'Parse failed 2',
        },
      ];

      const successful = getSuccessfulReviews(parseResults);

      expect(successful).toHaveLength(0);
    });

    it('should handle empty input', () => {
      const successful = getSuccessfulReviews([]);

      expect(successful).toHaveLength(0);
    });
  });

  describe('getFailedReviews', () => {
    it('should extract error messages from failed reviews', () => {
      const parseResults = [
        {
          success: true as const,
          review: {
            reviewer: 'reviewer1',
            issues: [],
            parseFailures: [],
          },
        },
        {
          success: false as const,
          error: 'Invalid format',
        },
        {
          success: false as const,
          error: 'Missing required field',
        },
      ];

      const failed = getFailedReviews(parseResults);

      expect(failed).toHaveLength(2);
      expect(failed).toContain('Invalid format');
      expect(failed).toContain('Missing required field');
    });

    it('should return empty array when all succeed', () => {
      const parseResults = [
        {
          success: true as const,
          review: {
            reviewer: 'reviewer1',
            issues: [],
            parseFailures: [],
          },
        },
      ];

      const failed = getFailedReviews(parseResults);

      expect(failed).toHaveLength(0);
    });

    it('should handle empty input', () => {
      const failed = getFailedReviews([]);

      expect(failed).toHaveLength(0);
    });
  });

  describe('Integration', () => {
    it('should handle complete workflow', () => {
      const executionResult: ExecutionResult = {
        executions: [
          {
            reviewer: 'reviewer1',
            status: 'success',
            response: `[CRITICAL] security | 5 | SQL Injection
Dangerous query
suggestion: Use parameterized queries
confidence: 1.0`,
            duration: 1000,
          },
          {
            reviewer: 'reviewer2',
            status: 'success',
            response: `[MINOR] style | 10 | Code formatting
Improve formatting
suggestion: Use prettier
confidence: 0.7`,
            duration: 1200,
          },
          {
            reviewer: 'reviewer3',
            status: 'failed',
            error: 'Connection failed',
            duration: 5000,
          },
        ],
        successful: 2,
        failed: 1,
      };

      const parseResults = collectReviews('app.ts', executionResult);
      const successful = getSuccessfulReviews(parseResults);
      const failed = getFailedReviews(parseResults);

      // Should have 2 parse results (2 successful executions)
      expect(parseResults).toHaveLength(2);

      // Should have 2 successful parses
      expect(successful).toHaveLength(2);
      expect(successful[0].reviewer).toBe('reviewer1');
      expect(successful[0].issues[0].severity).toBe('CRITICAL');
      expect(successful[1].reviewer).toBe('reviewer2');
      expect(successful[1].issues[0].severity).toBe('MINOR');

      // Should have 0 failed parses (all successful executions parsed successfully)
      expect(failed).toHaveLength(0);
    });
  });
});
