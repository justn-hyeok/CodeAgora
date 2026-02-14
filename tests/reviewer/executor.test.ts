import { describe, it, expect, vi } from 'vitest';
import { executeReviewers } from '../../src/reviewer/executor.js';
import type { Reviewer } from '../../src/config/schema.js';
import type { ReviewRequest } from '../../src/reviewer/types.js';
import type { ReviewerBackend } from '../../src/reviewer/adapter.js';

describe('Reviewer Executor', () => {
  const mockReviewers: Reviewer[] = [
    { name: 'r1', provider: 'openai', model: 'gpt-4', enabled: true, timeout: 300 },
    { name: 'r2', provider: 'anthropic', model: 'claude-3', enabled: true, timeout: 300 },
    { name: 'r3', provider: 'google', model: 'gemini', enabled: true, timeout: 300 },
    { name: 'r4', provider: 'openai', model: 'gpt-4', enabled: false, timeout: 300 },
  ];

  const mockRequest: ReviewRequest = {
    chunk: {
      file: 'test.ts',
      lineRange: [1, 10],
      content: 'sample diff',
      language: 'typescript',
    },
    systemPrompt: 'You are a reviewer',
    userPrompt: 'Review this',
  };

  describe('Parallel Execution', () => {
    it('should execute reviewers in parallel batches', async () => {
      const executionOrder: string[] = [];
      const mockBackend: ReviewerBackend = {
        async execute(reviewer: Reviewer) {
          executionOrder.push(`start-${reviewer.name}`);
          await new Promise((resolve) => setTimeout(resolve, 10));
          executionOrder.push(`end-${reviewer.name}`);
          return { success: true, response: 'OK' };
        },
      };

      const result = await executeReviewers(mockReviewers, mockRequest, 2, mockBackend);

      expect(result.successful).toBe(3);
      expect(result.executions).toHaveLength(3);

      // Verify batching: r1 and r2 should start before either ends (parallel)
      const r1Start = executionOrder.indexOf('start-r1');
      const r2Start = executionOrder.indexOf('start-r2');
      const r1End = executionOrder.indexOf('end-r1');
      const r2End = executionOrder.indexOf('end-r2');

      expect(r1Start).toBeLessThan(r1End);
      expect(r2Start).toBeLessThan(r2End);
      expect(Math.min(r1End, r2End)).toBeGreaterThan(Math.max(r1Start, r2Start));
    });

    it('should respect maxParallel limit', async () => {
      let concurrentExecutions = 0;
      let maxConcurrent = 0;

      const mockBackend: ReviewerBackend = {
        async execute() {
          concurrentExecutions++;
          maxConcurrent = Math.max(maxConcurrent, concurrentExecutions);
          await new Promise((resolve) => setTimeout(resolve, 10));
          concurrentExecutions--;
          return { success: true, response: 'OK' };
        },
      };

      await executeReviewers(mockReviewers, mockRequest, 2, mockBackend);

      expect(maxConcurrent).toBe(2);
    });

    it('should handle concurrent executions without data corruption', async () => {
      // Simulate concurrent executions with unique identifiers
      let executionCounter = 0;

      const mockBackend: ReviewerBackend = {
        async execute(reviewer: Reviewer) {
          const executionId = executionCounter++;
          await new Promise((resolve) => setTimeout(resolve, 5));
          return { success: true, response: `Response-${reviewer.name}-${executionId}` };
        },
      };

      const result = await executeReviewers(mockReviewers, mockRequest, 5, mockBackend);

      expect(result.successful).toBe(3);

      // All responses should be unique (no overwrites or data corruption)
      const successfulExecutions = result.executions.filter((e) => e.status === 'success');
      expect(successfulExecutions).toHaveLength(3);

      const responses = successfulExecutions.map((e) =>
        e.status === 'success' ? e.response : ''
      );
      const uniqueResponses = new Set(responses);
      expect(uniqueResponses.size).toBe(3);

      // Each response should contain the reviewer name
      expect(responses.every((r) => r.startsWith('Response-'))).toBe(true);
      expect(responses.some((r) => r.includes('r1'))).toBe(true);
      expect(responses.some((r) => r.includes('r2'))).toBe(true);
      expect(responses.some((r) => r.includes('r3'))).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should continue execution when some reviewers fail', async () => {
      let callCount = 0;
      const mockBackend: ReviewerBackend = {
        async execute(reviewer: Reviewer) {
          callCount++;
          if (reviewer.name === 'r2') {
            return { success: false, error: 'Network error' };
          }
          return { success: true, response: 'OK' };
        },
      };

      const result = await executeReviewers(mockReviewers, mockRequest, 5, mockBackend);

      expect(callCount).toBe(3); // Only enabled reviewers
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.executions).toHaveLength(3);
    });

    it('should handle all reviewers failing', async () => {
      const mockBackend: ReviewerBackend = {
        async execute() {
          return { success: false, error: 'All failed' };
        },
      };

      const result = await executeReviewers(mockReviewers, mockRequest, 5, mockBackend);

      expect(result.successful).toBe(0);
      expect(result.failed).toBe(3);
      expect(result.executions.every((e) => e.status === 'failed')).toBe(true);
    });

    it('should handle backend exceptions', async () => {
      const mockBackend: ReviewerBackend = {
        async execute() {
          throw new Error('Unexpected backend error');
        },
      };

      const result = await executeReviewers(mockReviewers, mockRequest, 5, mockBackend);

      expect(result.successful).toBe(0);
      expect(result.failed).toBe(3);
      expect(result.executions.every((e) => e.status === 'failed')).toBe(true);
      expect(result.executions[0].error).toContain('Unexpected backend error');
    });

    it('should handle timeout scenarios', async () => {
      const mockBackend: ReviewerBackend = {
        async execute() {
          const error: any = new Error('Timeout');
          error.killed = true;
          throw error;
        },
      };

      const result = await executeReviewers(mockReviewers, mockRequest, 5, mockBackend);

      expect(result.successful).toBe(0);
      expect(result.executions.every((e) => e.status === 'timeout')).toBe(true);
      expect(result.executions[0].error).toContain('Timeout after 300s');
    });
  });

  describe('Edge Cases', () => {
    it('should return empty result when no reviewers enabled', async () => {
      const disabledReviewers: Reviewer[] = [
        { name: 'r1', provider: 'openai', model: 'gpt-4', enabled: false, timeout: 300 },
      ];

      const mockBackend: ReviewerBackend = {
        async execute() {
          throw new Error('Should not be called');
        },
      };

      const result = await executeReviewers(disabledReviewers, mockRequest, 5, mockBackend);

      expect(result.executions).toHaveLength(0);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('should handle single reviewer', async () => {
      const singleReviewer: Reviewer[] = [mockReviewers[0]];

      const mockBackend: ReviewerBackend = {
        async execute() {
          return { success: true, response: 'Single review' };
        },
      };

      const result = await executeReviewers(singleReviewer, mockRequest, 5, mockBackend);

      expect(result.executions).toHaveLength(1);
      expect(result.successful).toBe(1);
    });

    it('should handle batch boundary with exact multiple', async () => {
      // 6 enabled reviewers, maxParallel = 3 → exactly 2 batches
      const sixReviewers: Reviewer[] = Array.from({ length: 6 }, (_, i) => ({
        name: `r${i}`,
        provider: 'openai',
        model: 'gpt-4',
        enabled: true,
        timeout: 300,
      }));

      const batchStarts: number[] = [];
      const mockBackend: ReviewerBackend = {
        async execute(reviewer: Reviewer) {
          batchStarts.push(parseInt(reviewer.name.slice(1)));
          await new Promise((resolve) => setTimeout(resolve, 5));
          return { success: true, response: 'OK' };
        },
      };

      await executeReviewers(sixReviewers, mockRequest, 3, mockBackend);

      // First batch: 0, 1, 2 should start before second batch: 3, 4, 5
      expect(batchStarts.slice(0, 3).every((n) => n < 3)).toBe(true);
      expect(batchStarts.slice(3, 6).every((n) => n >= 3)).toBe(true);
    });

    it('should track execution duration', async () => {
      const mockBackend: ReviewerBackend = {
        async execute() {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { success: true, response: 'OK' };
        },
      };

      const result = await executeReviewers([mockReviewers[0]], mockRequest, 5, mockBackend);

      expect(result.executions[0].duration).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Integration with Different Backends', () => {
    it('should work without explicit backend (uses default)', async () => {
      const result = await executeReviewers([mockReviewers[0]], mockRequest, 5);

      // Default backend is MockBackend
      expect(result.successful).toBe(1);
      expect(result.executions[0].status).toBe('success');
    });
  });
});
