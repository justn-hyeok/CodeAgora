import { describe, it, expect } from 'vitest';
import { shouldDebate, getMajorityVote } from '../../src/debate/judge.js';
import type { ParsedReview, ReviewIssue } from '../../src/parser/schema.js';

describe('Debate Judge', () => {
  describe('Critical Issues', () => {
    it('should require debate for critical issues', () => {
      const reviews: ParsedReview[] = [
        {
          reviewer: 'reviewer1',
          file: 'test.ts',
          issues: [
            {
              severity: 'CRITICAL',
              category: 'security',
              line: 10,
              title: 'SQL Injection',
              description: 'Vulnerability',
              suggestion: 'Use parameterized queries',
              confidence: 1.0,
            },
          ],
          parseFailures: [],
        },
      ];

      const decision = shouldDebate(reviews);

      expect(decision.required).toBe(true);
      expect(decision.reason).toContain('critical issue');
      expect(decision.issues).toHaveLength(1);
    });

    it('should not require debate for no critical issues', () => {
      const reviews: ParsedReview[] = [
        {
          reviewer: 'reviewer1',
          file: 'test.ts',
          issues: [
            {
              severity: 'MINOR',
              category: 'style',
              line: 10,
              title: 'Style issue',
              description: 'Description',
              suggestion: 'Fix it',
              confidence: 0.9,
            },
          ],
          parseFailures: [],
        },
      ];

      const decision = shouldDebate(reviews);

      expect(decision.required).toBe(false);
    });
  });

  describe('Severity Conflicts', () => {
    it('should require debate for severity conflicts on same line', () => {
      const reviews: ParsedReview[] = [
        {
          reviewer: 'reviewer1',
          file: 'test.ts',
          issues: [
            {
              severity: 'MAJOR',
              category: 'logic',
              line: 20,
              title: 'Logic error',
              description: 'Description',
              suggestion: 'Fix it',
              confidence: 0.9,
            },
          ],
          parseFailures: [],
        },
        {
          reviewer: 'reviewer2',
          file: 'test.ts',
          issues: [
            {
              severity: 'MINOR',
              category: 'logic',
              line: 20,
              title: 'Logic error',
              description: 'Description',
              suggestion: 'Fix it',
              confidence: 0.8,
            },
          ],
          parseFailures: [],
        },
      ];

      const decision = shouldDebate(reviews);

      expect(decision.required).toBe(true);
      expect(decision.reason).toContain('Conflicting severity opinions on test.ts:20');
      expect(decision.issues).toHaveLength(2);
    });

    it('should not require debate for same severity on same line', () => {
      const reviews: ParsedReview[] = [
        {
          reviewer: 'reviewer1',
          file: 'test.ts',
          issues: [
            {
              severity: 'MINOR',
              category: 'style',
              line: 15,
              title: 'Style issue',
              description: 'Description',
              suggestion: 'Fix it',
              confidence: 0.9,
            },
          ],
          parseFailures: [],
        },
        {
          reviewer: 'reviewer2',
          file: 'test.ts',
          issues: [
            {
              severity: 'MINOR',
              category: 'style',
              line: 15,
              title: 'Style issue',
              description: 'Description',
              suggestion: 'Fix it',
              confidence: 0.8,
            },
          ],
          parseFailures: [],
        },
      ];

      const decision = shouldDebate(reviews);

      expect(decision.required).toBe(false);
    });
  });

  describe('Low Confidence Major Issues', () => {
    it('should require debate for low confidence major issues', () => {
      const reviews: ParsedReview[] = [
        {
          reviewer: 'reviewer1',
          file: 'test.ts',
          issues: [
            {
              severity: 'MAJOR',
              category: 'performance',
              line: 30,
              title: 'Performance issue',
              description: 'Might be slow',
              suggestion: 'Optimize',
              confidence: 0.5,
            },
          ],
          parseFailures: [],
        },
      ];

      const decision = shouldDebate(reviews);

      expect(decision.required).toBe(true);
      expect(decision.reason).toContain('major issue(s) with low confidence');
      expect(decision.issues).toHaveLength(1);
    });

    it('should not require debate for high confidence major issues', () => {
      const reviews: ParsedReview[] = [
        {
          reviewer: 'reviewer1',
          file: 'test.ts',
          issues: [
            {
              severity: 'MAJOR',
              category: 'logic',
              line: 30,
              title: 'Logic error',
              description: 'Definite bug',
              suggestion: 'Fix',
              confidence: 0.95,
            },
          ],
          parseFailures: [],
        },
      ];

      const decision = shouldDebate(reviews);

      expect(decision.required).toBe(false);
    });

    it('should not trigger for low confidence minor issues', () => {
      const reviews: ParsedReview[] = [
        {
          reviewer: 'reviewer1',
          file: 'test.ts',
          issues: [
            {
              severity: 'MINOR',
              category: 'style',
              line: 40,
              title: 'Style issue',
              description: 'Maybe improve',
              suggestion: 'Consider it',
              confidence: 0.3,
            },
          ],
          parseFailures: [],
        },
      ];

      const decision = shouldDebate(reviews);

      expect(decision.required).toBe(false);
    });
  });

  describe('Multiple Reviewers on Same Line', () => {
    it('should NOT require debate when 3+ reviewers agree (strong majority)', () => {
      const reviews: ParsedReview[] = [
        {
          reviewer: 'reviewer1',
          file: 'test.ts',
          issues: [
            {
              severity: 'MINOR',
              category: 'style',
              line: 50,
              title: 'Issue',
              description: 'Description',
              suggestion: 'Fix',
              confidence: 0.8,
            },
          ],
          parseFailures: [],
        },
        {
          reviewer: 'reviewer2',
          file: 'test.ts',
          issues: [
            {
              severity: 'MINOR',
              category: 'style',
              line: 50,
              title: 'Issue',
              description: 'Description',
              suggestion: 'Fix',
              confidence: 0.8,
            },
          ],
          parseFailures: [],
        },
        {
          reviewer: 'reviewer3',
          file: 'test.ts',
          issues: [
            {
              severity: 'MINOR',
              category: 'style',
              line: 50,
              title: 'Issue',
              description: 'Description',
              suggestion: 'Fix',
              confidence: 0.8,
            },
          ],
          parseFailures: [],
        },
      ];

      const decision = shouldDebate(reviews);

      expect(decision.required).toBe(false);
      expect(decision.reason).toContain('strong majority');
    });

    it('should require debate when 3+ reviewers have conflicting opinions', () => {
      const reviews: ParsedReview[] = [
        {
          reviewer: 'reviewer1',
          file: 'test.ts',
          issues: [
            {
              severity: 'MAJOR',
              category: 'logic',
              line: 55,
              title: 'Logic issue',
              description: 'Description',
              suggestion: 'Fix',
              confidence: 0.8,
            },
          ],
          parseFailures: [],
        },
        {
          reviewer: 'reviewer2',
          file: 'test.ts',
          issues: [
            {
              severity: 'MINOR',
              category: 'logic',
              line: 55,
              title: 'Logic issue',
              description: 'Description',
              suggestion: 'Fix',
              confidence: 0.8,
            },
          ],
          parseFailures: [],
        },
        {
          reviewer: 'reviewer3',
          file: 'test.ts',
          issues: [
            {
              severity: 'MINOR',
              category: 'logic',
              line: 55,
              title: 'Logic issue',
              description: 'Description',
              suggestion: 'Fix',
              confidence: 0.8,
            },
          ],
          parseFailures: [],
        },
      ];

      const decision = shouldDebate(reviews);

      expect(decision.required).toBe(true);
      expect(decision.reason).toContain('Conflicting severity');
      expect(decision.issues).toHaveLength(3);
    });

    it('should not require debate for only 2 reviewers on same line', () => {
      const reviews: ParsedReview[] = [
        {
          reviewer: 'reviewer1',
          file: 'test.ts',
          issues: [
            {
              severity: 'MINOR',
              category: 'style',
              line: 60,
              title: 'Issue',
              description: 'Description',
              suggestion: 'Fix',
              confidence: 0.8,
            },
          ],
          parseFailures: [],
        },
        {
          reviewer: 'reviewer2',
          file: 'test.ts',
          issues: [
            {
              severity: 'MINOR',
              category: 'style',
              line: 60,
              title: 'Issue',
              description: 'Description',
              suggestion: 'Fix',
              confidence: 0.8,
            },
          ],
          parseFailures: [],
        },
      ];

      const decision = shouldDebate(reviews);

      expect(decision.required).toBe(false);
    });
  });

  describe('Priority Order', () => {
    it('should prioritize critical issues over other triggers', () => {
      const reviews: ParsedReview[] = [
        {
          reviewer: 'reviewer1',
          file: 'test.ts',
          issues: [
            {
              severity: 'CRITICAL',
              category: 'security',
              line: 10,
              title: 'Critical',
              description: 'Description',
              suggestion: 'Fix',
              confidence: 1.0,
            },
            {
              severity: 'MAJOR',
              category: 'logic',
              line: 20,
              title: 'Major',
              description: 'Description',
              suggestion: 'Fix',
              confidence: 0.5, // Would trigger low confidence check
            },
          ],
          parseFailures: [],
        },
      ];

      const decision = shouldDebate(reviews);

      expect(decision.required).toBe(true);
      expect(decision.reason).toContain('critical issue');
      expect(decision.issues).toHaveLength(1);
      expect(decision.issues[0].severity).toBe('CRITICAL');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty reviews', () => {
      const reviews: ParsedReview[] = [];

      const decision = shouldDebate(reviews);

      expect(decision.required).toBe(false);
      expect(decision.issues).toHaveLength(0);
    });

    it('should handle reviews with no issues', () => {
      const reviews: ParsedReview[] = [
        {
          reviewer: 'reviewer1',
          file: 'test.ts',
          issues: [],
          parseFailures: [],
        },
      ];

      const decision = shouldDebate(reviews);

      expect(decision.required).toBe(false);
    });
  });

  describe('Majority Voting Gate', () => {
    describe('getMajorityVote', () => {
      it('should calculate 100% majority correctly', () => {
        const issues: ReviewIssue[] = [
          { severity: 'MAJOR', category: 'logic', line: 10, title: 'Issue', confidence: 0.8 },
          { severity: 'MAJOR', category: 'logic', line: 10, title: 'Issue', confidence: 0.9 },
          { severity: 'MAJOR', category: 'logic', line: 10, title: 'Issue', confidence: 0.85 },
        ];

        const vote = getMajorityVote(issues);

        expect(vote).toEqual({
          severity: 'MAJOR',
          count: 3,
          total: 3,
          confidence: 1.0,
        });
      });

      it('should calculate 75% majority correctly', () => {
        const issues: ReviewIssue[] = [
          { severity: 'MINOR', category: 'style', line: 20, title: 'Issue', confidence: 0.8 },
          { severity: 'MINOR', category: 'style', line: 20, title: 'Issue', confidence: 0.8 },
          { severity: 'MINOR', category: 'style', line: 20, title: 'Issue', confidence: 0.8 },
          { severity: 'MAJOR', category: 'style', line: 20, title: 'Issue', confidence: 0.9 },
        ];

        const vote = getMajorityVote(issues);

        expect(vote).toEqual({
          severity: 'MINOR',
          count: 3,
          total: 4,
          confidence: 0.75,
        });
      });

      it('should handle split vote (50%)', () => {
        const issues: ReviewIssue[] = [
          { severity: 'MAJOR', category: 'logic', line: 30, title: 'Issue', confidence: 0.8 },
          { severity: 'MINOR', category: 'logic', line: 30, title: 'Issue', confidence: 0.8 },
        ];

        const vote = getMajorityVote(issues);

        expect(vote?.confidence).toBe(0.5);
        expect(vote?.total).toBe(2);
      });

      it('should return null for empty issues', () => {
        const vote = getMajorityVote([]);
        expect(vote).toBeNull();
      });
    });

    describe('Majority Gate Filtering', () => {
      it('should skip debate when 4 reviewers agree (100% majority)', () => {
        const reviews: ParsedReview[] = [
          {
            reviewer: 'reviewer1',
            file: 'test.ts',
            issues: [{ severity: 'MINOR', category: 'style', line: 40, title: 'Issue', confidence: 0.8 }],
            parseFailures: [],
          },
          {
            reviewer: 'reviewer2',
            file: 'test.ts',
            issues: [{ severity: 'MINOR', category: 'style', line: 40, title: 'Issue', confidence: 0.8 }],
            parseFailures: [],
          },
          {
            reviewer: 'reviewer3',
            file: 'test.ts',
            issues: [{ severity: 'MINOR', category: 'style', line: 40, title: 'Issue', confidence: 0.8 }],
            parseFailures: [],
          },
          {
            reviewer: 'reviewer4',
            file: 'test.ts',
            issues: [{ severity: 'MINOR', category: 'style', line: 40, title: 'Issue', confidence: 0.8 }],
            parseFailures: [],
          },
        ];

        const decision = shouldDebate(reviews);

        expect(decision.required).toBe(false);
        expect(decision.reason).toContain('strong majority');
      });

      it('should require debate when only 66% agree (below 75% threshold)', () => {
        const reviews: ParsedReview[] = [
          {
            reviewer: 'reviewer1',
            file: 'test.ts',
            issues: [{ severity: 'MINOR', category: 'style', line: 50, title: 'Issue', confidence: 0.8 }],
            parseFailures: [],
          },
          {
            reviewer: 'reviewer2',
            file: 'test.ts',
            issues: [{ severity: 'MINOR', category: 'style', line: 50, title: 'Issue', confidence: 0.8 }],
            parseFailures: [],
          },
          {
            reviewer: 'reviewer3',
            file: 'test.ts',
            issues: [{ severity: 'MAJOR', category: 'style', line: 50, title: 'Issue', confidence: 0.8 }],
            parseFailures: [],
          },
        ];

        const decision = shouldDebate(reviews);

        expect(decision.required).toBe(true);
        expect(decision.reason).toContain('Conflicting severity');
      });

      it('should skip debate for exactly 75% agreement', () => {
        const reviews: ParsedReview[] = [
          {
            reviewer: 'reviewer1',
            file: 'test.ts',
            issues: [{ severity: 'MINOR', category: 'style', line: 60, title: 'Issue', confidence: 0.8 }],
            parseFailures: [],
          },
          {
            reviewer: 'reviewer2',
            file: 'test.ts',
            issues: [{ severity: 'MINOR', category: 'style', line: 60, title: 'Issue', confidence: 0.8 }],
            parseFailures: [],
          },
          {
            reviewer: 'reviewer3',
            file: 'test.ts',
            issues: [{ severity: 'MINOR', category: 'style', line: 60, title: 'Issue', confidence: 0.8 }],
            parseFailures: [],
          },
          {
            reviewer: 'reviewer4',
            file: 'test.ts',
            issues: [{ severity: 'MAJOR', category: 'style', line: 60, title: 'Issue', confidence: 0.8 }],
            parseFailures: [],
          },
        ];

        const decision = shouldDebate(reviews);

        expect(decision.required).toBe(false);
        expect(decision.reason).toContain('strong majority');
      });

      it('should not apply majority gate to single reviewer (requires 2+ reviewers)', () => {
        const reviews: ParsedReview[] = [
          {
            reviewer: 'reviewer1',
            file: 'test.ts',
            issues: [{ severity: 'CRITICAL', category: 'security', line: 70, title: 'SQL Injection', confidence: 1.0 }],
            parseFailures: [],
          },
        ];

        const decision = shouldDebate(reviews);

        expect(decision.required).toBe(true);
        expect(decision.reason).toContain('critical');
      });
    });
  });
});
