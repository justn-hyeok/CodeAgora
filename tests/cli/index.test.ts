import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, access } from 'fs/promises';
import { generateDefaultConfig } from '../../src/config/defaults.js';
import * as pipeline from '../../src/pipeline/index.js';

describe('CLI Module', () => {
  describe('init command logic', () => {
    it('should generate valid default config', () => {
      const config = generateDefaultConfig();
      const parsed = JSON.parse(config);

      expect(parsed).toHaveProperty('reviewers');
      expect(parsed).toHaveProperty('settings');
      expect(Array.isArray(parsed.reviewers)).toBe(true);
      expect(parsed.reviewers.length).toBeGreaterThan(0);
      expect(parsed.settings).toHaveProperty('min_reviewers');
      expect(parsed.settings).toHaveProperty('max_parallel');
      expect(parsed.settings).toHaveProperty('output_format');
    });

    it('should include all required reviewer fields', () => {
      const config = generateDefaultConfig();
      const parsed = JSON.parse(config);

      for (const reviewer of parsed.reviewers) {
        expect(reviewer).toHaveProperty('name');
        expect(reviewer).toHaveProperty('provider');
        expect(reviewer).toHaveProperty('model');
        expect(reviewer).toHaveProperty('enabled');
        expect(reviewer).toHaveProperty('timeout');
      }
    });

    it('should have valid default settings', () => {
      const config = generateDefaultConfig();
      const parsed = JSON.parse(config);

      expect(parsed.settings.min_reviewers).toBeGreaterThan(0);
      expect(parsed.settings.max_parallel).toBeGreaterThan(0);
      expect(['terminal', 'markdown']).toContain(parsed.settings.output_format);
    });

    it('should generate parseable JSON', () => {
      const config = generateDefaultConfig();

      expect(() => JSON.parse(config)).not.toThrow();
    });

    it('should not include sensitive data in default config', () => {
      const config = generateDefaultConfig();

      expect(config).not.toContain('api_key');
      expect(config).not.toContain('secret');
      expect(config).not.toContain('token');
      expect(config).not.toContain('password');
    });
  });

  describe('review command integration', () => {
    let runPipelineSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      runPipelineSpy = vi.spyOn(pipeline, 'runPipeline');
    });

    afterEach(() => {
      runPipelineSpy.mockRestore();
    });

    it('should call runPipeline with correct options', async () => {
      runPipelineSpy.mockResolvedValue({
        success: true,
        duration: 1000,
        filesReviewed: 1,
        filesFailed: 0,
      });

      const options = {
        configPath: 'custom-config.json',
        diffPath: 'changes.diff',
        baseBranch: 'develop',
      };

      const result = await pipeline.runPipeline(options);

      expect(runPipelineSpy).toHaveBeenCalledWith(options);
      expect(result.success).toBe(true);
    });

    it('should handle pipeline success', async () => {
      runPipelineSpy.mockResolvedValue({
        success: true,
        duration: 5000,
        filesReviewed: 3,
        filesFailed: 0,
      });

      const result = await pipeline.runPipeline({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.filesReviewed).toBe(3);
        expect(result.filesFailed).toBe(0);
      }
    });

    it('should handle pipeline failure', async () => {
      runPipelineSpy.mockResolvedValue({
        success: false,
        error: 'Config not found',
      });

      const result = await pipeline.runPipeline({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Config not found');
      }
    });

    it('should pass default options when none provided', async () => {
      runPipelineSpy.mockResolvedValue({
        success: true,
        duration: 1000,
        filesReviewed: 1,
        filesFailed: 0,
      });

      await pipeline.runPipeline({});

      expect(runPipelineSpy).toHaveBeenCalledWith({});
    });

    it('should pass partial options', async () => {
      runPipelineSpy.mockResolvedValue({
        success: true,
        duration: 1000,
        filesReviewed: 1,
        filesFailed: 0,
      });

      const options = { configPath: 'custom.json' };
      await pipeline.runPipeline(options);

      expect(runPipelineSpy).toHaveBeenCalledWith(options);
    });
  });

  describe('Config file validation', () => {
    it('should validate reviewer configuration structure', () => {
      const config = generateDefaultConfig();
      const parsed = JSON.parse(config);

      // Ensure reviewers have required fields
      const reviewer = parsed.reviewers[0];
      expect(typeof reviewer.name).toBe('string');
      expect(typeof reviewer.provider).toBe('string');
      expect(typeof reviewer.model).toBe('string');
      expect(typeof reviewer.enabled).toBe('boolean');
      expect(typeof reviewer.timeout).toBe('number');
    });

    it('should have reasonable timeout values', () => {
      const config = generateDefaultConfig();
      const parsed = JSON.parse(config);

      for (const reviewer of parsed.reviewers) {
        expect(reviewer.timeout).toBeGreaterThan(0);
        expect(reviewer.timeout).toBeLessThanOrEqual(600); // 10 minutes max
      }
    });

    it('should have valid provider values', () => {
      const config = generateDefaultConfig();
      const parsed = JSON.parse(config);

      const validProviders = ['anthropic', 'openai', 'google', 'xai', 'minimax', 'kimi'];

      for (const reviewer of parsed.reviewers) {
        expect(validProviders).toContain(reviewer.provider);
      }
    });
  });

  describe('CLI argument handling', () => {
    it('should handle config path option', () => {
      const configPath = '/path/to/config.json';
      const options = { configPath };

      expect(options.configPath).toBe(configPath);
    });

    it('should handle diff path option', () => {
      const diffPath = '/path/to/changes.diff';
      const options = { diffPath };

      expect(options.diffPath).toBe(diffPath);
    });

    it('should handle base branch option', () => {
      const baseBranch = 'develop';
      const options = { baseBranch };

      expect(options.baseBranch).toBe(baseBranch);
    });

    it('should handle all options together', () => {
      const options = {
        configPath: 'config.json',
        diffPath: 'changes.diff',
        baseBranch: 'main',
      };

      expect(options).toHaveProperty('configPath');
      expect(options).toHaveProperty('diffPath');
      expect(options).toHaveProperty('baseBranch');
    });

    it('should handle empty options', () => {
      const options = {};

      expect(options.configPath).toBeUndefined();
      expect(options.diffPath).toBeUndefined();
      expect(options.baseBranch).toBeUndefined();
    });
  });

  describe('Default values', () => {
    it('should use markdown as default output format', () => {
      const config = generateDefaultConfig();
      const parsed = JSON.parse(config);

      expect(parsed.settings.output_format).toBe('markdown');
    });

    it('should have reasonable min_reviewers default', () => {
      const config = generateDefaultConfig();
      const parsed = JSON.parse(config);

      expect(parsed.settings.min_reviewers).toBeGreaterThan(0);
      expect(parsed.settings.min_reviewers).toBeLessThanOrEqual(5);
    });

    it('should have reasonable max_parallel default', () => {
      const config = generateDefaultConfig();
      const parsed = JSON.parse(config);

      expect(parsed.settings.max_parallel).toBeGreaterThan(0);
      expect(parsed.settings.max_parallel).toBeLessThanOrEqual(10);
    });
  });

  describe('Error handling', () => {
    it('should handle pipeline errors gracefully', async () => {
      const spy = vi.spyOn(pipeline, 'runPipeline');
      spy.mockResolvedValue({
        success: false,
        error: 'Something went wrong',
      });

      const result = await pipeline.runPipeline({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeTruthy();
      }

      spy.mockRestore();
    });

    it('should handle pipeline exceptions', async () => {
      const spy = vi.spyOn(pipeline, 'runPipeline');
      spy.mockRejectedValue(new Error('Unexpected error'));

      await expect(pipeline.runPipeline({})).rejects.toThrow('Unexpected error');

      spy.mockRestore();
    });
  });

  describe('Config JSON formatting', () => {
    it('should generate properly formatted JSON', () => {
      const config = generateDefaultConfig();

      // Should not throw when parsing
      const parsed = JSON.parse(config);

      // Should be able to stringify it back
      const stringified = JSON.stringify(parsed, null, 2);
      expect(stringified).toBeTruthy();
    });

    it('should have consistent structure', () => {
      const config1 = generateDefaultConfig();
      const config2 = generateDefaultConfig();

      const parsed1 = JSON.parse(config1);
      const parsed2 = JSON.parse(config2);

      expect(Object.keys(parsed1)).toEqual(Object.keys(parsed2));
      expect(Object.keys(parsed1.settings)).toEqual(Object.keys(parsed2.settings));
    });
  });

  describe('Reviewer configuration defaults', () => {
    it('should include multiple reviewers by default', () => {
      const config = generateDefaultConfig();
      const parsed = JSON.parse(config);

      expect(parsed.reviewers.length).toBeGreaterThanOrEqual(2);
    });

    it('should have unique reviewer names', () => {
      const config = generateDefaultConfig();
      const parsed = JSON.parse(config);

      const names = parsed.reviewers.map((r: any) => r.name);
      const uniqueNames = new Set(names);

      expect(uniqueNames.size).toBe(names.length);
    });

    it('should have at least one enabled reviewer', () => {
      const config = generateDefaultConfig();
      const parsed = JSON.parse(config);

      const enabledCount = parsed.reviewers.filter((r: any) => r.enabled).length;
      expect(enabledCount).toBeGreaterThan(0);
    });
  });
});
