import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubClient, parseGitHubRepo } from '../../src/github/client.js';
import type { SynthesisResult } from '../../src/head/synthesizer.js';
import type { DebateResult } from '../../src/debate/types.js';

describe('GitHub Client', () => {
  describe('parseGitHubRepo', () => {
    it('should parse URL format', () => {
      const result = parseGitHubRepo('https://github.com/owner/repo/pull/123');

      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        prNumber: 123,
      });
    });

    it('should parse short format', () => {
      const result = parseGitHubRepo('owner/repo#123');

      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        prNumber: 123,
      });
    });

    it('should parse repo only format', () => {
      const result = parseGitHubRepo('owner/repo');

      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        prNumber: undefined,
      });
    });

    it('should throw on invalid format', () => {
      expect(() => parseGitHubRepo('invalid')).toThrow();
    });
  });

  describe('GitHubClient', () => {
    let client: GitHubClient;

    beforeEach(() => {
      client = new GitHubClient({
        token: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
        prNumber: 123,
      });
    });

    describe('formatSummaryComment', () => {
      it('should format synthesis results', () => {
        const synthesis: SynthesisResult = {
          totalIssues: 3,
          bySeverity: {
            CRITICAL: 1,
            MAJOR: 1,
            MINOR: 1,
            SUGGESTION: 0,
          },
          issues: [
            {
              severity: 'CRITICAL',
              agreedSeverity: 'CRITICAL',
              category: 'security',
              line: 10,
              lineEnd: undefined,
              title: 'SQL Injection',
              description: 'Unsafe query',
              suggestion: 'Use parameterized queries',
              confidence: 1.0,
              reviewers: ['reviewer1', 'reviewer2'],
            },
            {
              severity: 'MAJOR',
              agreedSeverity: 'MAJOR',
              category: 'logic',
              line: 20,
              lineEnd: undefined,
              title: 'Logic error',
              description: 'Wrong condition',
              suggestion: 'Fix condition',
              confidence: 0.9,
              reviewers: ['reviewer1'],
            },
            {
              severity: 'MINOR',
              agreedSeverity: 'MINOR',
              category: 'style',
              line: 30,
              lineEnd: undefined,
              title: 'Style issue',
              description: 'Formatting',
              suggestion: 'Run formatter',
              confidence: 0.8,
              reviewers: ['reviewer2'],
            },
          ],
        };

        const metadata = {
          totalReviewers: 3,
          successfulReviewers: 2,
          duration: 5000,
        };

        // Access private method through type assertion
        const comment = (client as any).formatSummaryComment({
          synthesis,
          metadata,
        });

        expect(comment).toContain('Oh My CodeReview');
        expect(comment).toContain('Critical: 1');
        expect(comment).toContain('Major: 1');
        expect(comment).toContain('Minor: 1');
        expect(comment).toContain('SQL Injection');
        expect(comment).toContain('Logic error');
      });

      it('should include debate results if present', () => {
        const synthesis: SynthesisResult = {
          totalIssues: 1,
          bySeverity: {
            CRITICAL: 0,
            MAJOR: 1,
            MINOR: 0,
            SUGGESTION: 0,
          },
          issues: [
            {
              severity: 'MAJOR',
              agreedSeverity: 'MAJOR',
              category: 'logic',
              line: 10,
              lineEnd: undefined,
              title: 'Issue',
              description: 'Description',
              suggestion: 'Fix',
              confidence: 0.9,
              reviewers: ['r1', 'r2'],
            },
          ],
        };

        const debateResults: DebateResult[] = [
          {
            issue: {
              file: 'test.ts',
              line: 10,
              category: 'logic',
            },
            participants: [],
            rounds: 2,
            consensus: 'majority',
            finalSeverity: 'MAJOR',
            duration: 2000,
          },
        ];

        const comment = (client as any).formatSummaryComment({
          synthesis,
          debateResults,
          metadata: {
            totalReviewers: 2,
            successfulReviewers: 2,
            duration: 5000,
          },
        });

        expect(comment).toContain('Debates Conducted');
        expect(comment).toContain('test.ts:10');
        expect(comment).toContain('majority consensus');
      });
    });

    describe('getSeverityEmoji', () => {
      it('should return correct emojis', () => {
        const getEmoji = (client as any).getSeverityEmoji.bind(client);

        expect(getEmoji('CRITICAL')).toBe('🔴');
        expect(getEmoji('MAJOR')).toBe('🟠');
        expect(getEmoji('MINOR')).toBe('🟡');
        expect(getEmoji('SUGGESTION')).toBe('💡');
        expect(getEmoji('UNKNOWN')).toBe('⚪');
      });
    });
  });
});
