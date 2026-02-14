import { describe, it, expect } from 'vitest';
import { synthesizeReviews } from '../../src/head/synthesizer.js';
import type { ParsedReview } from '../../src/parser/schema.js';

describe('Review Synthesizer', () => {
  describe('Severity Voting', () => {
    it('should use majority voting - majority wins over minority', () => {
      const reviews: ParsedReview[] = [
        {
          reviewer: 'reviewer1',
          issues: [
            {
              severity: 'MINOR',
              category: 'style',
              line: 10,
              title: 'Issue 1',
              description: 'Description',
              suggestion: 'Fix it',
              confidence: 0.9,
            },
          ],
          parseFailures: [],
        },
        {
          reviewer: 'reviewer2',
          issues: [
            {
              severity: 'MINOR',
              category: 'style',
              line: 10,
              title: 'Issue 1',
              description: 'Description',
              suggestion: 'Fix it',
              confidence: 0.9,
            },
          ],
          parseFailures: [],
        },
        {
          reviewer: 'reviewer3',
          issues: [
            {
              severity: 'MINOR',
              category: 'style',
              line: 10,
              title: 'Issue 1',
              description: 'Description',
              suggestion: 'Fix it',
              confidence: 0.9,
            },
          ],
          parseFailures: [],
        },
        {
          reviewer: 'reviewer4',
          issues: [
            {
              severity: 'CRITICAL',
              category: 'style',
              line: 10,
              title: 'Issue 1',
              description: 'Description',
              suggestion: 'Fix it',
              confidence: 0.9,
            },
          ],
          parseFailures: [],
        },
      ];

      const result = synthesizeReviews(reviews);

      // 3 votes for MINOR vs 1 vote for CRITICAL → MINOR should win
      expect(result.issues[0].agreedSeverity).toBe('MINOR');
      expect(result.issues[0].reviewers).toHaveLength(4);
    });

    it('should escalate on tie - higher severity wins', () => {
      const reviews: ParsedReview[] = [
        {
          reviewer: 'reviewer1',
          issues: [
            {
              severity: 'MAJOR',
              category: 'security',
              line: 5,
              title: 'Security issue',
              description: 'Description',
              suggestion: 'Fix it',
              confidence: 0.8,
            },
          ],
          parseFailures: [],
        },
        {
          reviewer: 'reviewer2',
          issues: [
            {
              severity: 'MAJOR',
              category: 'security',
              line: 5,
              title: 'Security issue',
              description: 'Description',
              suggestion: 'Fix it',
              confidence: 0.8,
            },
          ],
          parseFailures: [],
        },
        {
          reviewer: 'reviewer3',
          issues: [
            {
              severity: 'MINOR',
              category: 'security',
              line: 5,
              title: 'Security issue',
              description: 'Description',
              suggestion: 'Fix it',
              confidence: 0.8,
            },
          ],
          parseFailures: [],
        },
        {
          reviewer: 'reviewer4',
          issues: [
            {
              severity: 'MINOR',
              category: 'security',
              line: 5,
              title: 'Security issue',
              description: 'Description',
              suggestion: 'Fix it',
              confidence: 0.8,
            },
          ],
          parseFailures: [],
        },
      ];

      const result = synthesizeReviews(reviews);

      // 2 votes MAJOR vs 2 votes MINOR → MAJOR should win (escalation on tie)
      expect(result.issues[0].agreedSeverity).toBe('MAJOR');
    });

    it('should handle unanimous votes', () => {
      const reviews: ParsedReview[] = [
        {
          reviewer: 'reviewer1',
          issues: [
            {
              severity: 'CRITICAL',
              category: 'security',
              line: 20,
              title: 'SQL Injection',
              description: 'Description',
              suggestion: 'Fix it',
              confidence: 1.0,
            },
          ],
          parseFailures: [],
        },
        {
          reviewer: 'reviewer2',
          issues: [
            {
              severity: 'CRITICAL',
              category: 'security',
              line: 20,
              title: 'SQL Injection',
              description: 'Description',
              suggestion: 'Fix it',
              confidence: 1.0,
            },
          ],
          parseFailures: [],
        },
      ];

      const result = synthesizeReviews(reviews);

      expect(result.issues[0].agreedSeverity).toBe('CRITICAL');
      expect(result.totalIssues).toBe(1);
    });

    it('should handle single reviewer vote', () => {
      const reviews: ParsedReview[] = [
        {
          reviewer: 'solo-reviewer',
          issues: [
            {
              severity: 'SUGGESTION',
              category: 'style',
              line: 1,
              title: 'Consider refactoring',
              description: 'Description',
              suggestion: 'Refactor this',
              confidence: 0.5,
            },
          ],
          parseFailures: [],
        },
      ];

      const result = synthesizeReviews(reviews);

      expect(result.issues[0].severity).toBe('SUGGESTION');
      expect(result.totalIssues).toBe(1);
    });
  });

  describe('Issue Grouping', () => {
    it('should group issues by line and category', () => {
      const reviews: ParsedReview[] = [
        {
          reviewer: 'reviewer1',
          issues: [
            {
              severity: 'MINOR',
              category: 'style',
              line: 10,
              title: 'Style issue',
              description: 'Description',
              suggestion: 'Fix style',
              confidence: 0.8,
            },
            {
              severity: 'MAJOR',
              category: 'logic',
              line: 20,
              title: 'Logic issue',
              description: 'Description',
              suggestion: 'Fix logic',
              confidence: 0.9,
            },
          ],
          parseFailures: [],
        },
        {
          reviewer: 'reviewer2',
          issues: [
            {
              severity: 'MINOR',
              category: 'style',
              line: 10,
              title: 'Style issue',
              description: 'Description',
              suggestion: 'Fix style',
              confidence: 0.8,
            },
          ],
          parseFailures: [],
        },
      ];

      const result = synthesizeReviews(reviews);

      // Should have 2 distinct issues
      expect(result.totalIssues).toBe(2);
      expect(result.issues).toHaveLength(2);

      // First issue should have 2 reviewers
      const styleIssue = result.issues.find((i) => i.category === 'style');
      expect(styleIssue?.reviewers).toHaveLength(2);

      // Second issue should have 1 reviewer
      const logicIssue = result.issues.find((i) => i.category === 'logic');
      expect(logicIssue?.reviewers).toHaveLength(1);
    });

    it('should calculate severity distribution', () => {
      const reviews: ParsedReview[] = [
        {
          reviewer: 'reviewer1',
          issues: [
            {
              severity: 'CRITICAL',
              category: 'security',
              line: 1,
              title: 'Critical issue',
              description: 'Description',
              suggestion: 'Fix it',
              confidence: 1.0,
            },
            {
              severity: 'MAJOR',
              category: 'logic',
              line: 2,
              title: 'Major issue',
              description: 'Description',
              suggestion: 'Fix it',
              confidence: 0.9,
            },
            {
              severity: 'MINOR',
              category: 'style',
              line: 3,
              title: 'Minor issue',
              description: 'Description',
              suggestion: 'Fix it',
              confidence: 0.7,
            },
          ],
          parseFailures: [],
        },
      ];

      const result = synthesizeReviews(reviews);

      expect(result.bySeverity.CRITICAL).toBe(1);
      expect(result.bySeverity.MAJOR).toBe(1);
      expect(result.bySeverity.MINOR).toBe(1);
      expect(result.bySeverity.SUGGESTION).toBe(0);
      expect(result.totalIssues).toBe(3);
    });
  });
});
