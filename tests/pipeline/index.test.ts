import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runPipeline } from '../../src/pipeline/index.js';
import * as configLoader from '../../src/config/loader.js';
import * as diffExtractor from '../../src/diff/extractor.js';
import * as reviewerPrompt from '../../src/reviewer/prompt.js';
import * as reviewerExecutor from '../../src/reviewer/executor.js';
import * as reviewerCollector from '../../src/reviewer/collector.js';
import * as debateJudge from '../../src/debate/judge.js';
import * as headSynthesizer from '../../src/head/synthesizer.js';
import * as headReporter from '../../src/head/reporter.js';
import type { Config } from '../../src/config/schema.js';
import type { DiffChunk } from '../../src/diff/types.js';

describe('Pipeline', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  const mockConfig: Config = {
    reviewers: [
      { name: 'r1', provider: 'openai', model: 'gpt-4', enabled: true, timeout: 300 },
      { name: 'r2', provider: 'anthropic', model: 'claude-3', enabled: true, timeout: 300 },
    ],
    settings: {
      min_reviewers: 2,
      max_parallel: 3,
      output_format: 'terminal',
    },
  };

  const mockChunk: DiffChunk = {
    file: 'test.ts',
    lineRange: [1, 10],
    content: 'diff content',
    language: 'typescript',
  };

  describe('Success Cases', () => {
    it('should complete full pipeline successfully', async () => {
      vi.spyOn(configLoader, 'loadConfig').mockResolvedValue({
        success: true,
        data: mockConfig,
      });

      vi.spyOn(diffExtractor, 'extractDiff').mockResolvedValue({
        success: true,
        chunks: [mockChunk],
      });

      vi.spyOn(reviewerPrompt, 'loadSystemPrompt').mockResolvedValue('system prompt');
      vi.spyOn(reviewerPrompt, 'generateUserPrompt').mockResolvedValue('user prompt');

      vi.spyOn(reviewerExecutor, 'executeReviewers').mockResolvedValue({
        executions: [
          { reviewer: 'r1', status: 'success', response: '[MINOR] style | 1 | Issue', duration: 100 },
          { reviewer: 'r2', status: 'success', response: '[MINOR] style | 1 | Issue', duration: 120 },
        ],
        successful: 2,
        failed: 0,
      });

      vi.spyOn(reviewerCollector, 'collectReviews').mockReturnValue([
        {
          success: true,
          review: {
            reviewer: 'r1',
            file: 'test.ts',
            issues: [{ severity: 'MINOR', category: 'style', line: 1, title: 'Issue', confidence: 0.5 }],
            parseFailures: [],
          },
        },
      ]);

      vi.spyOn(reviewerCollector, 'getSuccessfulReviews').mockReturnValue([
        {
          reviewer: 'r1',
          file: 'test.ts',
          issues: [{ severity: 'MINOR', category: 'style', line: 1, title: 'Issue', confidence: 0.5 }],
          parseFailures: [],
        },
      ]);

      vi.spyOn(debateJudge, 'shouldDebate').mockReturnValue({
        required: false,
        reason: 'No debate needed',
        issues: [],
      });

      vi.spyOn(headSynthesizer, 'synthesizeReviews').mockReturnValue({
        issues: [],
        totalIssues: 0,
        bySeverity: { CRITICAL: 0, MAJOR: 0, MINOR: 0, SUGGESTION: 0 },
      });

      vi.spyOn(headReporter, 'printTerminalReport').mockImplementation(() => {});

      const result = await runPipeline({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.filesReviewed).toBe(1);
        expect(result.filesFailed).toBe(0);
        expect(result.duration).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle multiple chunks in parallel batches', async () => {
      const chunks = [
        { ...mockChunk, file: 'file1.ts' },
        { ...mockChunk, file: 'file2.ts' },
        { ...mockChunk, file: 'file3.ts' },
      ];

      vi.spyOn(configLoader, 'loadConfig').mockResolvedValue({
        success: true,
        data: { ...mockConfig, settings: { ...mockConfig.settings, max_parallel: 2 } },
      });

      vi.spyOn(diffExtractor, 'extractDiff').mockResolvedValue({
        success: true,
        chunks,
      });

      vi.spyOn(reviewerPrompt, 'loadSystemPrompt').mockResolvedValue('system prompt');
      vi.spyOn(reviewerPrompt, 'generateUserPrompt').mockResolvedValue('user prompt');

      vi.spyOn(reviewerExecutor, 'executeReviewers').mockResolvedValue({
        executions: [
          { reviewer: 'r1', status: 'success', response: '[MINOR] style | 1 | Issue', duration: 100 },
        ],
        successful: 1,
        failed: 0,
      });

      vi.spyOn(reviewerCollector, 'collectReviews').mockReturnValue([]);
      vi.spyOn(reviewerCollector, 'getSuccessfulReviews').mockReturnValue([]);
      vi.spyOn(debateJudge, 'shouldDebate').mockReturnValue({
        required: false,
        reason: 'No debate',
        issues: [],
      });
      vi.spyOn(headSynthesizer, 'synthesizeReviews').mockReturnValue({
        issues: [],
        totalIssues: 0,
        bySeverity: { CRITICAL: 0, MAJOR: 0, MINOR: 0, SUGGESTION: 0 },
      });
      vi.spyOn(headReporter, 'printTerminalReport').mockImplementation(() => {});

      const result = await runPipeline({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.filesReviewed).toBe(3);
      }
    });

    it('should pass custom options to config and diff extraction', async () => {
      const loadConfigSpy = vi.spyOn(configLoader, 'loadConfig').mockResolvedValue({
        success: true,
        data: mockConfig,
      });

      const extractDiffSpy = vi.spyOn(diffExtractor, 'extractDiff').mockResolvedValue({
        success: true,
        chunks: [],
      });

      await runPipeline({
        configPath: 'custom-config.json',
        diffPath: 'custom.diff',
        baseBranch: 'develop',
      });

      expect(loadConfigSpy).toHaveBeenCalledWith('custom-config.json');
      expect(extractDiffSpy).toHaveBeenCalledWith({
        path: 'custom.diff',
        baseBranch: 'develop',
      });
    });
  });

  describe('Failure Cases', () => {
    it('should fail when config loading fails', async () => {
      vi.spyOn(configLoader, 'loadConfig').mockResolvedValue({
        success: false,
        error: 'Config not found',
      });

      const result = await runPipeline({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Config not found');
      }
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Config not found'));
    });

    it('should fail when diff extraction fails', async () => {
      vi.spyOn(configLoader, 'loadConfig').mockResolvedValue({
        success: true,
        data: mockConfig,
      });

      vi.spyOn(diffExtractor, 'extractDiff').mockResolvedValue({
        success: false,
        error: 'No git repository',
      });

      const result = await runPipeline({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('No git repository');
      }
    });

    it('should fail chunk when all reviewers fail', async () => {
      vi.spyOn(configLoader, 'loadConfig').mockResolvedValue({
        success: true,
        data: mockConfig,
      });

      vi.spyOn(diffExtractor, 'extractDiff').mockResolvedValue({
        success: true,
        chunks: [mockChunk],
      });

      vi.spyOn(reviewerPrompt, 'loadSystemPrompt').mockResolvedValue('system');
      vi.spyOn(reviewerPrompt, 'generateUserPrompt').mockResolvedValue('user');

      vi.spyOn(reviewerExecutor, 'executeReviewers').mockResolvedValue({
        executions: [
          { reviewer: 'r1', status: 'failed', error: 'Network error', duration: 50 },
          { reviewer: 'r2', status: 'timeout', error: 'Timeout', duration: 300000 },
        ],
        successful: 0,
        failed: 2,
      });

      const result = await runPipeline({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('1 file(s) failed review');
      }
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('All reviewers failed'));
    });

    it('should track failed chunks correctly with multiple chunks', async () => {
      const chunks = [
        { ...mockChunk, file: 'success.ts' },
        { ...mockChunk, file: 'fail.ts' },
        { ...mockChunk, file: 'success2.ts' },
      ];

      vi.spyOn(configLoader, 'loadConfig').mockResolvedValue({
        success: true,
        data: mockConfig,
      });

      vi.spyOn(diffExtractor, 'extractDiff').mockResolvedValue({
        success: true,
        chunks,
      });

      vi.spyOn(reviewerPrompt, 'loadSystemPrompt').mockResolvedValue('system');
      vi.spyOn(reviewerPrompt, 'generateUserPrompt').mockResolvedValue('user');

      // Mock to fail on second file
      let callCount = 0;
      vi.spyOn(reviewerExecutor, 'executeReviewers').mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          // Second file fails
          return { executions: [], successful: 0, failed: 2 };
        }
        return {
          executions: [
            { reviewer: 'r1', status: 'success', response: '[MINOR] style | 1 | Issue', duration: 100 },
          ],
          successful: 1,
          failed: 0,
        };
      });

      vi.spyOn(reviewerCollector, 'collectReviews').mockReturnValue([]);
      vi.spyOn(reviewerCollector, 'getSuccessfulReviews').mockReturnValue([]);
      vi.spyOn(debateJudge, 'shouldDebate').mockReturnValue({
        required: false,
        reason: '',
        issues: [],
      });
      vi.spyOn(headSynthesizer, 'synthesizeReviews').mockReturnValue({
        issues: [],
        totalIssues: 0,
        bySeverity: { CRITICAL: 0, MAJOR: 0, MINOR: 0, SUGGESTION: 0 },
      });
      vi.spyOn(headReporter, 'printTerminalReport').mockImplementation(() => {});

      const result = await runPipeline({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('1 file(s) failed review');
      }
    });

    it('should handle pipeline exception gracefully', async () => {
      vi.spyOn(configLoader, 'loadConfig').mockRejectedValue(new Error('Unexpected crash'));

      const result = await runPipeline({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Unexpected crash');
      }
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Pipeline failed'));
    });

    it('should handle non-Error exceptions', async () => {
      vi.spyOn(configLoader, 'loadConfig').mockRejectedValue('String error');

      const result = await runPipeline({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('String error');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty diff (no chunks)', async () => {
      vi.spyOn(configLoader, 'loadConfig').mockResolvedValue({
        success: true,
        data: mockConfig,
      });

      vi.spyOn(diffExtractor, 'extractDiff').mockResolvedValue({
        success: true,
        chunks: [],
      });

      const result = await runPipeline({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.filesReviewed).toBe(0);
        expect(result.filesFailed).toBe(0);
      }
    });

    it('should respect max_parallel limit with many chunks', async () => {
      const manyChunks = Array.from({ length: 10 }, (_, i) => ({
        ...mockChunk,
        file: `file${i}.ts`,
      }));

      vi.spyOn(configLoader, 'loadConfig').mockResolvedValue({
        success: true,
        data: { ...mockConfig, settings: { ...mockConfig.settings, max_parallel: 3 } },
      });

      vi.spyOn(diffExtractor, 'extractDiff').mockResolvedValue({
        success: true,
        chunks: manyChunks,
      });

      vi.spyOn(reviewerPrompt, 'loadSystemPrompt').mockResolvedValue('system');
      vi.spyOn(reviewerPrompt, 'generateUserPrompt').mockResolvedValue('user');
      vi.spyOn(reviewerExecutor, 'executeReviewers').mockResolvedValue({
        executions: [
          { reviewer: 'r1', status: 'success', response: '[MINOR] style | 1 | Issue', duration: 100 },
        ],
        successful: 1,
        failed: 0,
      });
      vi.spyOn(reviewerCollector, 'collectReviews').mockReturnValue([]);
      vi.spyOn(reviewerCollector, 'getSuccessfulReviews').mockReturnValue([]);
      vi.spyOn(debateJudge, 'shouldDebate').mockReturnValue({
        required: false,
        reason: '',
        issues: [],
      });
      vi.spyOn(headSynthesizer, 'synthesizeReviews').mockReturnValue({
        issues: [],
        totalIssues: 0,
        bySeverity: { CRITICAL: 0, MAJOR: 0, MINOR: 0, SUGGESTION: 0 },
      });
      vi.spyOn(headReporter, 'printTerminalReport').mockImplementation(() => {});

      const result = await runPipeline({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.filesReviewed).toBe(10);
      }
    });

    it('should display progress for multiple files', async () => {
      const chunks = [
        { ...mockChunk, file: 'file1.ts' },
        { ...mockChunk, file: 'file2.ts' },
      ];

      vi.spyOn(configLoader, 'loadConfig').mockResolvedValue({
        success: true,
        data: mockConfig,
      });

      vi.spyOn(diffExtractor, 'extractDiff').mockResolvedValue({
        success: true,
        chunks,
      });

      vi.spyOn(reviewerPrompt, 'loadSystemPrompt').mockResolvedValue('system');
      vi.spyOn(reviewerPrompt, 'generateUserPrompt').mockResolvedValue('user');
      vi.spyOn(reviewerExecutor, 'executeReviewers').mockResolvedValue({
        executions: [
          { reviewer: 'r1', status: 'success', response: '[MINOR] style | 1 | Issue', duration: 100 },
        ],
        successful: 1,
        failed: 0,
      });
      vi.spyOn(reviewerCollector, 'collectReviews').mockReturnValue([]);
      vi.spyOn(reviewerCollector, 'getSuccessfulReviews').mockReturnValue([]);
      vi.spyOn(debateJudge, 'shouldDebate').mockReturnValue({
        required: false,
        reason: '',
        issues: [],
      });
      vi.spyOn(headSynthesizer, 'synthesizeReviews').mockReturnValue({
        issues: [],
        totalIssues: 0,
        bySeverity: { CRITICAL: 0, MAJOR: 0, MINOR: 0, SUGGESTION: 0 },
      });
      vi.spyOn(headReporter, 'printTerminalReport').mockImplementation(() => {});

      await runPipeline({});

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Progress:'));
    });

    it('should not display progress for single file', async () => {
      vi.spyOn(configLoader, 'loadConfig').mockResolvedValue({
        success: true,
        data: mockConfig,
      });

      vi.spyOn(diffExtractor, 'extractDiff').mockResolvedValue({
        success: true,
        chunks: [mockChunk],
      });

      vi.spyOn(reviewerPrompt, 'loadSystemPrompt').mockResolvedValue('system');
      vi.spyOn(reviewerPrompt, 'generateUserPrompt').mockResolvedValue('user');
      vi.spyOn(reviewerExecutor, 'executeReviewers').mockResolvedValue({
        executions: [
          { reviewer: 'r1', status: 'success', response: '[MINOR] style | 1 | Issue', duration: 100 },
        ],
        successful: 1,
        failed: 0,
      });
      vi.spyOn(reviewerCollector, 'collectReviews').mockReturnValue([]);
      vi.spyOn(reviewerCollector, 'getSuccessfulReviews').mockReturnValue([]);
      vi.spyOn(debateJudge, 'shouldDebate').mockReturnValue({
        required: false,
        reason: '',
        issues: [],
      });
      vi.spyOn(headSynthesizer, 'synthesizeReviews').mockReturnValue({
        issues: [],
        totalIssues: 0,
        bySeverity: { CRITICAL: 0, MAJOR: 0, MINOR: 0, SUGGESTION: 0 },
      });
      vi.spyOn(headReporter, 'printTerminalReport').mockImplementation(() => {});

      await runPipeline({});

      const progressCalls = consoleLogSpy.mock.calls.filter((call) =>
        String(call[0]).includes('Progress:')
      );
      expect(progressCalls).toHaveLength(0);
    });
  });
});
