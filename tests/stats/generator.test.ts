import { describe, it, expect } from 'vitest';
import { formatStatsReport, generateStats } from '../../src/stats/generator.js';
import type { ReviewStats, ReviewHistoryEntry } from '../../src/storage/types.js';

describe('Stats Generator', () => {
  describe('generateStats', () => {
    it('should handle empty history', () => {
      const stats = generateStats([]);

      expect(stats.totalReviews).toBe(0);
      expect(stats.totalIssues).toBe(0);
      expect(stats.averageDuration).toBe(0);
    });

    it('should calculate stats correctly', () => {
      const history: ReviewHistoryEntry[] = [
        {
          id: '1',
          schemaVersion: 1,
          timestamp: Date.now(),
          file: 'test.ts',
          reviewers: ['reviewer1', 'reviewer2'],
          totalIssues: 5,
          severities: { CRITICAL: 1, MAJOR: 2, MINOR: 1, SUGGESTION: 1 },
          duration: 1000,
          debateOccurred: true,
          supportersUsed: 2,
        },
        {
          id: '2',
          schemaVersion: 1,
          timestamp: Date.now(),
          file: 'test2.ts',
          reviewers: ['reviewer1'],
          totalIssues: 3,
          severities: { CRITICAL: 0, MAJOR: 1, MINOR: 1, SUGGESTION: 1 },
          duration: 2000,
          debateOccurred: false,
          supportersUsed: 0,
        },
      ];

      const stats = generateStats(history);

      expect(stats.totalReviews).toBe(2);
      expect(stats.totalIssues).toBe(8);
      expect(stats.totalFiles).toBe(2);
      expect(stats.averageDuration).toBe(1500);
      expect(stats.averageIssuesPerReview).toBe(4);
      expect(stats.issuesBySeverity.CRITICAL).toBe(1);
      expect(stats.issuesBySeverity.MAJOR).toBe(3);
      expect(stats.debateCount).toBe(1);
      expect(stats.supporterCount).toBe(1);
    });

    it('should track reviewer usage', () => {
      const history: ReviewHistoryEntry[] = [
        {
          id: '1',
          schemaVersion: 1,
          timestamp: Date.now(),
          file: 'test.ts',
          reviewers: ['reviewer1', 'reviewer2'],
          totalIssues: 5,
          severities: { CRITICAL: 0, MAJOR: 0, MINOR: 0, SUGGESTION: 5 },
          duration: 1000,
          debateOccurred: false,
          supportersUsed: 0,
        },
        {
          id: '2',
          schemaVersion: 1,
          timestamp: Date.now(),
          file: 'test2.ts',
          reviewers: ['reviewer1', 'reviewer3'],
          totalIssues: 3,
          severities: { CRITICAL: 0, MAJOR: 0, MINOR: 0, SUGGESTION: 3 },
          duration: 2000,
          debateOccurred: false,
          supportersUsed: 0,
        },
      ];

      const stats = generateStats(history);

      expect(stats.reviewerUsage['reviewer1']).toBe(2);
      expect(stats.reviewerUsage['reviewer2']).toBe(1);
      expect(stats.reviewerUsage['reviewer3']).toBe(1);
    });
  });

  describe('formatStatsReport', () => {
    it('should format stats report', () => {
      const stats: ReviewStats = {
        totalReviews: 10,
        totalIssues: 50,
        totalFiles: 8,
        averageDuration: 5000,
        averageIssuesPerReview: 5,
        issuesBySeverity: {
          CRITICAL: 5,
          MAJOR: 15,
          MINOR: 20,
          SUGGESTION: 10,
        },
        reviewerUsage: {
          reviewer1: 10,
          reviewer2: 8,
        },
        debateCount: 3,
        supporterCount: 7,
      };

      const report = formatStatsReport(stats);

      expect(report).toContain('Total Reviews: 10');
      expect(report).toContain('Total Issues Found: 50');
      expect(report).toContain('CRITICAL: 5');
      expect(report).toContain('MAJOR: 15');
      expect(report).toContain('reviewer1: 10');
      expect(report).toContain('Debates: 3');
    });

    it('should handle stats with no reviewers', () => {
      const stats: ReviewStats = {
        totalReviews: 5,
        totalIssues: 10,
        totalFiles: 5,
        averageDuration: 1000,
        averageIssuesPerReview: 2,
        issuesBySeverity: {
          CRITICAL: 0,
          MAJOR: 0,
          MINOR: 5,
          SUGGESTION: 5,
        },
        reviewerUsage: {},
        debateCount: 0,
        supporterCount: 0,
      };

      const report = formatStatsReport(stats);

      expect(report).toContain('Total Reviews: 5');
      expect(report).not.toContain('Reviewer Usage:');
    });
  });
});
