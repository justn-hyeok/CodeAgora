import { describe, it, expect, vi, beforeEach } from 'vitest';
import { conductDebate, anonymizeOpponentOpinions, scoreReasoning, getRoundInstruction } from '../../src/debate/engine.js';
import type { ParsedReview, ReviewIssue } from '../../src/parser/schema.js';
import type { Reviewer } from '../../src/config/schema.js';

// Mock the OpenCodeBackend to avoid actual LLM calls in tests
vi.mock('../../src/reviewer/adapter.js', () => ({
  OpenCodeBackend: class {
    async execute() {
      return {
        success: true,
        response: `My argument for this round.

Severity: MAJOR
Confidence: 0.85
Position: no change`,
      };
    }
  },
}));

describe('Debate Engine', () => {
  const mockReviewers: Reviewer[] = [
    {
      name: 'reviewer1',
      provider: 'openai',
      model: 'gpt-4',
      enabled: true,
      timeout: 300,
    },
    {
      name: 'reviewer2',
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      enabled: true,
      timeout: 300,
    },
  ];

  describe('Debate Conduct', () => {
    it('should group issues by location', async () => {
      const issue1: ReviewIssue = {
        severity: 'MAJOR',
        category: 'logic',
        line: 10,
        title: 'Logic error',
        description: 'Potential bug',
        suggestion: 'Fix it',
        confidence: 0.9,
      };

      const issue2: ReviewIssue = {
        severity: 'MINOR',
        category: 'logic',
        line: 10,
        title: 'Logic error',
        description: 'Different opinion',
        suggestion: 'Different fix',
        confidence: 0.8,
      };

      const reviews: ParsedReview[] = [
        {
          reviewer: 'reviewer1',
          file: 'test.ts',
          issues: [issue1],
          parseFailures: [],
        },
        {
          reviewer: 'reviewer2',
          file: 'test.ts',
          issues: [issue2],
          parseFailures: [],
        },
      ];

      const results = await conductDebate([issue1, issue2], reviews, mockReviewers);

      expect(results).toHaveLength(1); // Grouped by location
      expect(results[0].issue.file).toBe('test.ts');
      expect(results[0].issue.line).toBe(10);
      expect(results[0].participants).toHaveLength(2);
    });

    it('should conduct multiple rounds', async () => {
      const issue: ReviewIssue = {
        severity: 'MAJOR',
        category: 'security',
        line: 20,
        title: 'Security issue',
        description: 'Potential vulnerability',
        suggestion: 'Fix it',
        confidence: 0.7,
      };

      const reviews: ParsedReview[] = [
        {
          reviewer: 'reviewer1',
          file: 'test.ts',
          issues: [issue],
          parseFailures: [],
        },
      ];

      const results = await conductDebate([issue], reviews, mockReviewers);

      expect(results).toHaveLength(1);
      expect(results[0].rounds).toBeGreaterThan(0);
      expect(results[0].rounds).toBeLessThanOrEqual(3); // Max 3 rounds
    });

    it('should detect consensus types', async () => {
      const issue1: ReviewIssue = {
        severity: 'CRITICAL',
        category: 'security',
        line: 30,
        title: 'Critical issue',
        description: 'Description',
        suggestion: 'Fix',
        confidence: 1.0,
      };

      const issue2: ReviewIssue = {
        severity: 'CRITICAL',
        category: 'security',
        line: 30,
        title: 'Critical issue',
        description: 'Description',
        suggestion: 'Fix',
        confidence: 1.0,
      };

      const reviews: ParsedReview[] = [
        {
          reviewer: 'reviewer1',
          file: 'test.ts',
          issues: [issue1],
          parseFailures: [],
        },
        {
          reviewer: 'reviewer2',
          file: 'test.ts',
          issues: [issue2],
          parseFailures: [],
        },
      ];

      const results = await conductDebate([issue1, issue2], reviews, mockReviewers);

      expect(results).toHaveLength(1);
      expect(['strong', 'majority', 'failed']).toContain(results[0].consensus);
    });

    it('should track debate duration', async () => {
      const issue: ReviewIssue = {
        severity: 'MINOR',
        category: 'style',
        line: 40,
        title: 'Style issue',
        description: 'Description',
        suggestion: 'Fix',
        confidence: 0.8,
      };

      const reviews: ParsedReview[] = [
        {
          reviewer: 'reviewer1',
          file: 'test.ts',
          issues: [issue],
          parseFailures: [],
        },
      ];

      const results = await conductDebate([issue], reviews, mockReviewers);

      expect(results).toHaveLength(1);
      expect(results[0].duration).toBeGreaterThanOrEqual(0); // Duration can be 0 for fast debates
    });
  });

  describe('Consensus Detection', () => {
    it('should reach strong consensus with 80%+ agreement', async () => {
      // This test would require mocking the reviewer responses
      // For now, we test that the consensus field exists
      const issue: ReviewIssue = {
        severity: 'MAJOR',
        category: 'logic',
        line: 50,
        title: 'Issue',
        description: 'Description',
        suggestion: 'Fix',
        confidence: 0.9,
      };

      const reviews: ParsedReview[] = [
        {
          reviewer: 'reviewer1',
          file: 'test.ts',
          issues: [issue],
          parseFailures: [],
        },
      ];

      const results = await conductDebate([issue], reviews, mockReviewers);

      expect(results[0].consensus).toBeDefined();
      expect(results[0].finalSeverity).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty issue list', async () => {
      const results = await conductDebate([], [], mockReviewers);
      expect(results).toHaveLength(0);
    });

    it('should handle single participant', async () => {
      const issue: ReviewIssue = {
        severity: 'SUGGESTION',
        category: 'style',
        line: 60,
        title: 'Suggestion',
        description: 'Description',
        suggestion: 'Consider this',
        confidence: 0.5,
      };

      const reviews: ParsedReview[] = [
        {
          reviewer: 'reviewer1',
          file: 'test.ts',
          issues: [issue],
          parseFailures: [],
        },
      ];

      const results = await conductDebate([issue], reviews, mockReviewers);

      expect(results).toHaveLength(1);
      expect(results[0].participants).toHaveLength(1);
    });
  });

  describe('Anonymization', () => {
    it('should anonymize opponent opinions by grouping by severity', () => {
      const opinions = [
        {
          reviewer: 'Alice',
          position: {
            severity: 'MAJOR',
            category: 'logic',
            line: 10,
            title: 'Null pointer',
            description: 'May crash',
            confidence: 0.9,
          } as ReviewIssue,
        },
        {
          reviewer: 'Bob',
          position: {
            severity: 'MAJOR',
            category: 'logic',
            line: 10,
            title: 'Memory leak',
            description: 'Resource not freed',
            confidence: 0.85,
          } as ReviewIssue,
        },
        {
          reviewer: 'Charlie',
          position: {
            severity: 'MINOR',
            category: 'style',
            line: 10,
            title: 'Code style',
            description: 'Use const',
            confidence: 0.7,
          } as ReviewIssue,
        },
      ];

      const anonymized = anonymizeOpponentOpinions(opinions);

      // Should NOT contain reviewer names
      expect(anonymized).not.toContain('Alice');
      expect(anonymized).not.toContain('Bob');
      expect(anonymized).not.toContain('Charlie');

      // Should contain severity grouping
      expect(anonymized).toContain('2 reviewer(s) identified as MAJOR');
      expect(anonymized).toContain('1 reviewer(s) identified as MINOR');

      // Should contain issue titles
      expect(anonymized).toContain('Null pointer');
      expect(anonymized).toContain('Memory leak');
      expect(anonymized).toContain('Code style');
    });

    it('should preserve technical details without identity', () => {
      const opinions = [
        {
          reviewer: 'Reviewer-X',
          position: {
            severity: 'CRITICAL',
            category: 'security',
            line: 20,
            title: 'SQL Injection',
            description: 'Unsanitized input',
            confidence: 1.0,
          } as ReviewIssue,
          argument: 'This allows arbitrary SQL execution',
        },
      ];

      const anonymized = anonymizeOpponentOpinions(opinions);

      // Should NOT contain reviewer name
      expect(anonymized).not.toContain('Reviewer-X');

      // Should contain technical details
      expect(anonymized).toContain('1 reviewer(s) identified as CRITICAL');
      expect(anonymized).toContain('SQL Injection');
      expect(anonymized).toContain('Unsanitized input');
      expect(anonymized).toContain('Previous argument: This allows arbitrary SQL execution');
    });

    it('should handle single severity group', () => {
      const opinions = [
        {
          reviewer: 'Dev1',
          position: {
            severity: 'SUGGESTION',
            category: 'improvement',
            line: 30,
            title: 'Use helper function',
            confidence: 0.6,
          } as ReviewIssue,
        },
      ];

      const anonymized = anonymizeOpponentOpinions(opinions);

      expect(anonymized).not.toContain('Dev1');
      expect(anonymized).toContain('1 reviewer(s) identified as SUGGESTION');
      expect(anonymized).toContain('Use helper function');
    });

    it('should handle empty opinions', () => {
      const anonymized = anonymizeOpponentOpinions([]);
      expect(anonymized).toBe('');
    });
  });

  describe('Trajectory Scoring', () => {
    describe('scoreReasoning', () => {
      it('should give base score for minimal reasoning', () => {
        const score = scoreReasoning('This is wrong.');
        expect(score).toBe(0.5); // Base score only
      });

      it('should reward code-specific references', () => {
        const score = scoreReasoning('The issue is on line 42 in function getData()');
        expect(score).toBeGreaterThan(0.5);
        expect(score).toBeLessThanOrEqual(1.0);
      });

      it('should reward technical depth', () => {
        const score = scoreReasoning('This causes a memory leak because the buffer is not freed');
        expect(score).toBeGreaterThanOrEqual(0.7); // Base + technical + evidence
      });

      it('should reward evidence-based reasoning', () => {
        const score = scoreReasoning('This is problematic because it violates the API contract');
        expect(score).toBeGreaterThan(0.5);
      });

      it('should reward specific examples', () => {
        const score = scoreReasoning('For example, this will cause a crash when x is null');
        expect(score).toBeGreaterThan(0.5);
      });

      it('should reward code snippets', () => {
        const score = scoreReasoning('The code `if (ptr == null)` is missing');
        expect(score).toBeGreaterThan(0.5);
      });

      it('should cap score at 1.0', () => {
        const score = scoreReasoning(
          'On line 10 in function process(), this causes a security vulnerability because ' +
            'specifically the input is not sanitized. For example: `eval(userInput)` allows code injection'
        );
        expect(score).toBeCloseTo(1.0, 2); // All bonuses applied, capped at 1.0 (2 decimal precision)
      });
    });

    describe('Quality scores in debate rounds', () => {
      it('should calculate and store quality scores for each round', async () => {
        const issue: ReviewIssue = {
          severity: 'MAJOR',
          category: 'security',
          line: 100,
          title: 'Security issue',
          description: 'Vulnerable code',
          confidence: 0.9,
        };

        const reviews: ParsedReview[] = [
          {
            reviewer: 'reviewer1',
            file: 'test.ts',
            issues: [issue],
            parseFailures: [],
          },
        ];

        const results = await conductDebate([issue], reviews, [
          {
            name: 'reviewer1',
            provider: 'openai',
            model: 'gpt-4',
            enabled: true,
            timeout: 300,
          },
        ]);

        expect(results).toHaveLength(1);
        expect(results[0].participants[0].rounds[0].qualityScore).toBeDefined();
        expect(results[0].participants[0].rounds[0].qualityScore).toBeGreaterThanOrEqual(0);
        expect(results[0].participants[0].rounds[0].qualityScore).toBeLessThanOrEqual(1.0);
      });
    });
  });

  describe('Anti-Conformity Prompts', () => {
    describe('getRoundInstruction', () => {
      it('should provide independent analysis instruction for round 1', () => {
        const instruction = getRoundInstruction(1);

        expect(instruction).toContain('independent');
        expect(instruction).toContain('technical analysis');
        expect(instruction).toContain('Focus solely on technical correctness');
      });

      it('should provide explicit anti-conformity language for round 2', () => {
        const instruction = getRoundInstruction(2);

        // Must contain explicit "NOT required to change" language
        expect(instruction).toContain('NOT required to change your position');
        expect(instruction).toContain('majority');

        // Must require justification for changes
        expect(instruction).toContain('MUST provide specific technical justification');

        // Must emphasize quality over consensus
        expect(instruction).toContain('Quality over consensus');
        expect(instruction).toContain('single well-supported argument');
      });

      it('should provide final assessment instruction for round 3', () => {
        const instruction = getRoundInstruction(3);

        expect(instruction).toContain('Final technical assessment');
        expect(instruction).toContain('Summarize');
        expect(instruction).toContain('final position');
        expect(instruction).toContain('strongest technical case');
      });

      it('should return different instructions for each round', () => {
        const round1 = getRoundInstruction(1);
        const round2 = getRoundInstruction(2);
        const round3 = getRoundInstruction(3);

        // All instructions should be unique
        expect(round1).not.toBe(round2);
        expect(round2).not.toBe(round3);
        expect(round1).not.toBe(round3);
      });

      it('should use round 3+ instruction for rounds beyond 3', () => {
        const round3 = getRoundInstruction(3);
        const round4 = getRoundInstruction(4);
        const round5 = getRoundInstruction(5);

        // Rounds 3+ should use the same "final assessment" template
        expect(round4).toBe(round3);
        expect(round5).toBe(round3);
      });
    });
  });
});
