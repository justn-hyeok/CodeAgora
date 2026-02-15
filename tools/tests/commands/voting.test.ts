/**
 * Voting command tests
 * 75% Majority Voting Gate - Core innovation
 * Migrated from src/debate/judge.ts tests
 */

import { describe, it, expect } from 'vitest';
import { voting } from '../../src/commands/voting.js';
import type { ParsedReview, VotingOutput } from '../../src/types/index.js';

function parseVotingOutput(jsonString: string): VotingOutput {
  return JSON.parse(jsonString);
}

function createReview(
  reviewer: string,
  file: string,
  issues: Array<{ severity: string; line: number; title: string; confidence?: number }>
): ParsedReview {
  return {
    reviewer,
    file,
    issues: issues.map((issue) => ({
      severity: issue.severity as any,
      category: 'Test',
      line: issue.line,
      title: issue.title,
      confidence: issue.confidence ?? 0.5,
    })),
    parseFailures: [],
  };
}

describe('voting command', () => {
  describe('Consensus Detection', () => {
    it('should detect unanimous consensus (3/3 agree)', () => {
      const reviews: ParsedReview[] = [
        createReview('r1', 'test.ts', [{ severity: 'critical', line: 10, title: 'SQL Injection' }]),
        createReview('r2', 'test.ts', [{ severity: 'critical', line: 10, title: 'SQL Injection' }]),
        createReview('r3', 'test.ts', [{ severity: 'critical', line: 10, title: 'SQL Injection' }]),
      ];

      const input = JSON.stringify({ reviews, threshold: 0.75 });
      const output = parseVotingOutput(voting(input));

      expect(output.stats.consensus).toBe(1);
      expect(output.stats.needsDebate).toBe(0);
      expect(output.consensusIssues).toHaveLength(1);
      expect(output.consensusIssues[0].agreedSeverity).toBe('critical');
      expect(output.consensusIssues[0].confidence).toBe(1.0); // 3/3 = 100%
      expect(output.consensusIssues[0].debateRequired).toBe(false);
    });

    it('should detect 75% consensus exactly (3/4)', () => {
      const reviews: ParsedReview[] = [
        createReview('r1', 'test.ts', [{ severity: 'warning', line: 10, title: 'Issue' }]),
        createReview('r2', 'test.ts', [{ severity: 'warning', line: 10, title: 'Issue' }]),
        createReview('r3', 'test.ts', [{ severity: 'warning', line: 10, title: 'Issue' }]),
        createReview('r4', 'test.ts', [{ severity: 'suggestion', line: 10, title: 'Issue' }]),
      ];

      const input = JSON.stringify({ reviews, threshold: 0.75 });
      const output = parseVotingOutput(voting(input));

      expect(output.stats.consensus).toBe(1);
      expect(output.consensusIssues[0].confidence).toBe(0.75); // Exactly at threshold
      expect(output.consensusIssues[0].debateRequired).toBe(false);
    });

    it('should trigger debate below 75% threshold (2/4 = 50%)', () => {
      const reviews: ParsedReview[] = [
        createReview('r1', 'test.ts', [{ severity: 'critical', line: 10, title: 'Issue' }]),
        createReview('r2', 'test.ts', [{ severity: 'critical', line: 10, title: 'Issue' }]),
        createReview('r3', 'test.ts', [{ severity: 'warning', line: 10, title: 'Issue' }]),
        createReview('r4', 'test.ts', [{ severity: 'warning', line: 10, title: 'Issue' }]),
      ];

      const input = JSON.stringify({ reviews, threshold: 0.75 });
      const output = parseVotingOutput(voting(input));

      expect(output.stats.needsDebate).toBe(1);
      expect(output.debateIssues).toHaveLength(1);
      expect(output.debateIssues[0].debateRequired).toBe(true);
      expect(output.debateIssues[0].confidence).toBe(0.5); // 2/4
    });
  });

  describe('Debate Triggers', () => {
    it('should trigger debate for 2-person disagreement', () => {
      const reviews: ParsedReview[] = [
        createReview('r1', 'test.ts', [{ severity: 'critical', line: 10, title: 'Issue' }]),
        createReview('r2', 'test.ts', [{ severity: 'warning', line: 10, title: 'Issue' }]),
      ];

      const input = JSON.stringify({ reviews, threshold: 0.75 });
      const output = parseVotingOutput(voting(input));

      // 1/2 = 50% < 75% → debate
      expect(output.stats.needsDebate).toBe(1);
      expect(output.debateIssues[0].severityDistribution).toHaveProperty('critical', 1);
      expect(output.debateIssues[0].severityDistribution).toHaveProperty('warning', 1);
    });

    it('should NOT trigger debate for single reviewer (no majority possible)', () => {
      const reviews: ParsedReview[] = [
        createReview('r1', 'test.ts', [{ severity: 'critical', line: 10, title: 'Issue' }]),
      ];

      const input = JSON.stringify({ reviews, threshold: 0.75 });
      const output = parseVotingOutput(voting(input));

      // Single reviewer is treated as weak consensus, not debate
      // Because you need at least 2 reviewers for majority voting
      expect(output.stats.consensus).toBe(1);
      expect(output.stats.needsDebate).toBe(0);
    });

    it('should trigger debate for critical issues without strong majority', () => {
      const reviews: ParsedReview[] = [
        createReview('r1', 'test.ts', [{ severity: 'critical', line: 10, title: 'Issue' }]),
        createReview('r2', 'test.ts', [{ severity: 'warning', line: 10, title: 'Issue' }]),
        createReview('r3', 'test.ts', [{ severity: 'warning', line: 10, title: 'Issue' }]),
      ];

      const input = JSON.stringify({ reviews, threshold: 0.75 });
      const output = parseVotingOutput(voting(input));

      // Even though warning has 2/3 (66%), critical issue triggers debate
      expect(output.stats.needsDebate).toBe(1);
      expect(output.debateIssues[0].opinions.some((o) => o.severity === 'critical')).toBe(true);
    });

    it('should trigger debate for low-confidence warning (< 0.7)', () => {
      const reviews: ParsedReview[] = [
        createReview('r1', 'test.ts', [
          { severity: 'warning', line: 10, title: 'Issue', confidence: 0.6 },
        ]),
        createReview('r2', 'test.ts', [
          { severity: 'warning', line: 10, title: 'Issue', confidence: 0.5 },
        ]),
      ];

      const input = JSON.stringify({ reviews, threshold: 0.75 });
      const output = parseVotingOutput(voting(input));

      // Low confidence warnings should trigger debate
      expect(output.stats.needsDebate).toBe(1);
    });

    it('should trigger debate when 3+ reviewers identify same location', () => {
      const reviews: ParsedReview[] = [
        createReview('r1', 'test.ts', [{ severity: 'suggestion', line: 10, title: 'Issue' }]),
        createReview('r2', 'test.ts', [{ severity: 'suggestion', line: 10, title: 'Issue' }]),
        createReview('r3', 'test.ts', [{ severity: 'nitpick', line: 10, title: 'Issue' }]),
      ];

      const input = JSON.stringify({ reviews, threshold: 0.75 });
      const output = parseVotingOutput(voting(input));

      // 3+ reviewers pointing to same location → debate
      // Even if severity is low, multiple eyes on same issue warrants debate
      expect(output.debateIssues[0].opinions).toHaveLength(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty review array', () => {
      const input = JSON.stringify({ reviews: [], threshold: 0.75 });
      const output = parseVotingOutput(voting(input));

      expect(output.stats.totalIssueGroups).toBe(0);
      expect(output.stats.consensus).toBe(0);
      expect(output.stats.needsDebate).toBe(0);
      expect(output.consensusIssues).toHaveLength(0);
      expect(output.debateIssues).toHaveLength(0);
    });

    it('should handle reviews with no issues', () => {
      const reviews: ParsedReview[] = [
        createReview('r1', 'test.ts', []),
        createReview('r2', 'test.ts', []),
      ];

      const input = JSON.stringify({ reviews, threshold: 0.75 });
      const output = parseVotingOutput(voting(input));

      expect(output.stats.totalIssueGroups).toBe(0);
    });

    it('should group by file:line:title correctly', () => {
      const reviews: ParsedReview[] = [
        createReview('r1', 'test.ts', [
          { severity: 'warning', line: 10, title: 'Issue A' },
          { severity: 'warning', line: 20, title: 'Issue B' },
        ]),
        createReview('r2', 'test.ts', [
          { severity: 'warning', line: 10, title: 'Issue A' },
          { severity: 'warning', line: 20, title: 'Issue C' }, // Different title
        ]),
      ];

      const input = JSON.stringify({ reviews, threshold: 0.75 });
      const output = parseVotingOutput(voting(input));

      // Line 10 Issue A: 2 reviewers → consensus
      // Line 20 Issue B: 1 reviewer → weak consensus (single reviewer)
      // Line 20 Issue C: 1 reviewer → weak consensus (single reviewer)
      expect(output.stats.totalIssueGroups).toBe(3);
    });

    it('should include voter names in consensus issues', () => {
      const reviews: ParsedReview[] = [
        createReview('alice', 'test.ts', [{ severity: 'warning', line: 10, title: 'Issue', confidence: 0.8 }]),
        createReview('bob', 'test.ts', [{ severity: 'warning', line: 10, title: 'Issue', confidence: 0.9 }]),
        createReview('charlie', 'test.ts', [{ severity: 'warning', line: 10, title: 'Issue', confidence: 0.85 }]),
      ];

      const input = JSON.stringify({ reviews, threshold: 0.75 });
      const output = parseVotingOutput(voting(input));

      expect(output.consensusIssues[0].voters).toEqual(['alice', 'bob', 'charlie']);
    });

    it('should include all opinions in debate issues', () => {
      const reviews: ParsedReview[] = [
        createReview('r1', 'test.ts', [{ severity: 'critical', line: 10, title: 'Issue' }]),
        createReview('r2', 'test.ts', [{ severity: 'warning', line: 10, title: 'Issue' }]),
      ];

      const input = JSON.stringify({ reviews, threshold: 0.75 });
      const output = parseVotingOutput(voting(input));

      expect(output.debateIssues[0].opinions).toHaveLength(2);
      expect(output.debateIssues[0].opinions[0].reviewer).toBe('r1');
      expect(output.debateIssues[0].opinions[1].reviewer).toBe('r2');
    });
  });

  describe('Output Schema Validation', () => {
    it('should return correct schema structure', () => {
      const reviews: ParsedReview[] = [
        createReview('r1', 'test.ts', [{ severity: 'warning', line: 10, title: 'Issue' }]),
      ];

      const input = JSON.stringify({ reviews, threshold: 0.75 });
      const output = parseVotingOutput(voting(input));

      // Validate top-level structure
      expect(output).toHaveProperty('consensusIssues');
      expect(output).toHaveProperty('debateIssues');
      expect(output).toHaveProperty('stats');

      // Validate stats
      expect(output.stats).toHaveProperty('totalIssueGroups');
      expect(output.stats).toHaveProperty('consensus');
      expect(output.stats).toHaveProperty('needsDebate');
      expect(typeof output.stats.totalIssueGroups).toBe('number');
      expect(typeof output.stats.consensus).toBe('number');
      expect(typeof output.stats.needsDebate).toBe('number');

      // Validate consensus issue structure
      if (output.consensusIssues.length > 0) {
        const issue = output.consensusIssues[0];
        expect(issue).toHaveProperty('issueGroup');
        expect(issue).toHaveProperty('agreedSeverity');
        expect(issue).toHaveProperty('confidence');
        expect(issue).toHaveProperty('debateRequired', false);
        expect(issue).toHaveProperty('voters');
      }
    });
  });
});
