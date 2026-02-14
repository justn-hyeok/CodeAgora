import { describe, it, expect } from 'vitest';
import {
  formatReviewSummary,
  formatDebateResult,
  formatIssue,
  formatSupporterResults,
  formatStatsText,
} from '../../src/discord/formatter.js';
import type { SynthesisResult } from '../../src/head/synthesizer.js';
import type { DebateResult } from '../../src/debate/types.js';
import type { ReviewIssue } from '../../src/parser/schema.js';
import type { SupporterExecutionResult } from '../../src/supporter/types.js';

describe('Discord Formatter', () => {
  describe('formatReviewSummary', () => {
    it('should format a review summary', () => {
      const synthesis: SynthesisResult = {
        issues: [
          {
            file: 'test.ts',
            line: 10,
            category: 'security',
            title: 'SQL Injection vulnerability',
            description: 'User input not sanitized',
            severity: 'CRITICAL',
            confidence: 0.9,
            reviewers: ['reviewer1'],
            votes: { CRITICAL: 1, MAJOR: 0, MINOR: 0, SUGGESTION: 0 },
            agreedSeverity: 'CRITICAL',
          },
        ],
        totalIssues: 1,
        bySeverity: { CRITICAL: 1, MAJOR: 0, MINOR: 0, SUGGESTION: 0 },
      };

      const embed = formatReviewSummary('test.ts', synthesis);

      expect(embed.title).toContain('test.ts');
      expect(embed.description).toContain('Total Issues');
      expect(embed.color).toBe(0xdc2626); // CRITICAL color
      expect(embed.fields).toHaveLength(1);
      expect(embed.fields![0].name).toContain('CRITICAL');
    });

    it('should handle reviews with no issues', () => {
      const synthesis: SynthesisResult = {
        issues: [],
        totalIssues: 0,
        bySeverity: { CRITICAL: 0, MAJOR: 0, MINOR: 0, SUGGESTION: 0 },
      };

      const embed = formatReviewSummary('test.ts', synthesis);

      expect(embed.title).toContain('test.ts');
      expect(embed.fields).toBeUndefined();
    });

    it('should truncate long field values to Discord limits', () => {
      // Create a field value that exceeds Discord's 1024 char limit
      const longDescription = 'A'.repeat(1100);
      const synthesis: SynthesisResult = {
        issues: [
          {
            file: 'test.ts',
            line: 10,
            category: 'style',
            title: 'Long issue',
            description: longDescription,
            severity: 'SUGGESTION',
            confidence: 0.7,
            reviewers: ['reviewer1'],
            votes: { CRITICAL: 0, MAJOR: 0, MINOR: 0, SUGGESTION: 1 },
            agreedSeverity: 'SUGGESTION',
          },
        ],
        totalIssues: 1,
        bySeverity: { CRITICAL: 0, MAJOR: 0, MINOR: 0, SUGGESTION: 1 },
      };

      const embed = formatReviewSummary('test.ts', synthesis);

      // Field value should be truncated to 1024 chars (Discord limit)
      expect(embed.fields![0].value.length).toBeLessThanOrEqual(1024);
      expect(embed.fields![0].value).toContain('...');
    });
  });

  describe('formatDebateResult', () => {
    it('should format a debate result', () => {
      const debate: DebateResult = {
        issue: {
          file: 'test.ts',
          line: 20,
          category: 'logic',
        },
        participants: [
          {
            reviewer: 'reviewer1',
            position: {
              line: 20,
              category: 'logic',
              title: 'Issue',
              severity: 'MAJOR',
              confidence: 0.8,
            },
            rounds: [
              {
                roundNumber: 1,
                argument: 'Initial argument',
                confidence: 0.8,
                changedPosition: false,
                severity: 'MAJOR',
              },
            ],
          },
        ],
        rounds: 1,
        consensus: 'strong',
        finalSeverity: 'MAJOR',
        duration: 1000,
      };

      const embed = formatDebateResult(debate);

      expect(embed.title).toContain('Debate');
      expect(embed.description).toContain('test.ts:20');
      expect(embed.description).toContain('strong');
      expect(embed.color).toBe(0x10b981); // green for strong consensus
    });

    it('should use yellow color for majority consensus', () => {
      const debate: DebateResult = {
        issue: { file: 'test.ts', line: 20, category: 'logic' },
        participants: [],
        rounds: 2,
        consensus: 'majority',
        finalSeverity: 'MINOR',
        duration: 2000,
      };

      const embed = formatDebateResult(debate);

      expect(embed.color).toBe(0xfbbf24); // yellow
    });

    it('should use red color for failed consensus', () => {
      const debate: DebateResult = {
        issue: { file: 'test.ts', line: 20, category: 'logic' },
        participants: [],
        rounds: 3,
        consensus: 'failed',
        finalSeverity: 'MAJOR',
        duration: 3000,
      };

      const embed = formatDebateResult(debate);

      expect(embed.color).toBe(0xef4444); // red
    });
  });

  describe('formatIssue', () => {
    it('should format a single issue', () => {
      const issue: ReviewIssue = {
        line: 15,
        category: 'performance',
        title: 'Inefficient loop',
        description: 'Use map instead of forEach',
        severity: 'MINOR',
        confidence: 0.75,
      };

      const embed = formatIssue(issue);

      expect(embed.title).toContain('MINOR');
      expect(embed.title).toContain('Inefficient loop');
      expect(embed.description).toBe('Use map instead of forEach');
      expect(embed.color).toBe(0xfbbf24); // MINOR color
      expect(embed.fields).toHaveLength(3);
    });
  });

  describe('formatSupporterResults', () => {
    it('should format successful supporter results', () => {
      const results: SupporterExecutionResult[] = [
        { supporter: 'codex', success: true },
        { supporter: 'gemini', success: true },
      ];

      const embed = formatSupporterResults(results);

      expect(embed.title).toContain('Supporter');
      expect(embed.description).toContain('**Successful**: 2');
      expect(embed.fields).toHaveLength(2);
      expect(embed.color).toBe(0x10b981); // green
    });

    it('should format failed supporter results', () => {
      const results: SupporterExecutionResult[] = [
        { supporter: 'codex', success: true },
        { supporter: 'gemini', success: false, error: 'Connection failed' },
      ];

      const embed = formatSupporterResults(results);

      expect(embed.description).toContain('**Failed**: 1');
      expect(embed.fields).toHaveLength(2);
      expect(embed.fields![1].name).toContain('❌');
      expect(embed.color).toBe(0xfbbf24); // yellow (has failures)
    });
  });

  describe('formatStatsText', () => {
    it('should format stats as text', () => {
      const stats = {
        critical: 2,
        major: 3,
        minor: 5,
        suggestion: 10,
        total: 20,
      };

      const text = formatStatsText(stats);

      expect(text).toContain('CRITICAL: 2');
      expect(text).toContain('MAJOR: 3');
      expect(text).toContain('**Total**: 20');
    });
  });
});
