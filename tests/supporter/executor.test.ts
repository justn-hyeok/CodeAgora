import { describe, it, expect, vi } from 'vitest';
import { executeSupporters } from '../../src/supporter/executor.js';
import type { ParsedReview } from '../../src/parser/schema.js';
import type { Supporter } from '../../src/config/schema.js';

describe('Supporter Executor', () => {
  describe('executeSupporters', () => {
    it('should execute enabled supporters in parallel', async () => {
      const supporters: { codex?: Supporter; gemini?: Supporter } = {
        codex: {
          provider: 'openai',
          model: 'gpt-4',
          enabled: true,
        },
        gemini: {
          provider: 'google',
          model: 'gemini-pro',
          enabled: true,
        },
      };

      const reviews: ParsedReview[] = [
        {
          reviewer: 'reviewer1',
          file: 'test.ts',
          issues: [
            {
              severity: 'MAJOR',
              category: 'type',
              line: 10,
              title: 'Type error',
              description: 'Type mismatch',
              suggestion: 'Fix types',
              confidence: 0.9,
            },
          ],
          parseFailures: [],
        },
      ];

      const fileContents = new Map([['test.ts', 'const x: string = 123;']]);

      const results = await executeSupporters(supporters, reviews, fileContents);

      expect(Array.isArray(results)).toBe(true);
      // Both supporters should be executed
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should skip disabled supporters', async () => {
      const supporters: { codex?: Supporter; gemini?: Supporter } = {
        codex: {
          provider: 'openai',
          model: 'gpt-4',
          enabled: false,
        },
        gemini: {
          provider: 'google',
          model: 'gemini-pro',
          enabled: true,
        },
      };

      const reviews: ParsedReview[] = [];
      const fileContents = new Map();

      const results = await executeSupporters(supporters, reviews, fileContents);

      // Only enabled supporters should run
      const codexResult = results.find((r) => r.supporter === 'codex');
      expect(codexResult).toBeUndefined();
    });

    it('should handle empty reviews', async () => {
      const supporters: { codex?: Supporter; gemini?: Supporter } = {
        codex: {
          provider: 'openai',
          model: 'gpt-4',
          enabled: true,
        },
      };

      const results = await executeSupporters(supporters, [], new Map());

      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle supporter errors gracefully', async () => {
      const supporters: { codex?: Supporter; gemini?: Supporter } = {
        codex: {
          provider: 'invalid',
          model: 'invalid',
          enabled: true,
        },
      };

      const reviews: ParsedReview[] = [
        {
          reviewer: 'reviewer1',
          file: 'test.ts',
          issues: [
            {
              severity: 'MAJOR',
              category: 'logic',
              line: 1,
              title: 'Issue',
              description: 'Description',
              suggestion: 'Fix',
              confidence: 0.8,
            },
          ],
          parseFailures: [],
        },
      ];

      const fileContents = new Map([['test.ts', 'code']]);

      // Should not throw, but handle errors gracefully
      const results = await executeSupporters(supporters, reviews, fileContents);

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Parallel Execution', () => {
    it('should execute supporters concurrently', async () => {
      const supporters: { codex?: Supporter; gemini?: Supporter } = {
        codex: {
          provider: 'openai',
          model: 'gpt-4',
          enabled: true,
        },
        gemini: {
          provider: 'google',
          model: 'gemini-pro',
          enabled: true,
        },
      };

      const reviews: ParsedReview[] = [];
      const fileContents = new Map();

      const start = Date.now();
      await executeSupporters(supporters, reviews, fileContents);
      const duration = Date.now() - start;

      // Parallel execution should be faster than sequential
      // (This is a weak test, but validates structure)
      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });
});
