import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { loadConfig, getDefaultConfig } from '../../src/config/loader.js';
import type { Config } from '../../src/config/schema.js';

const TEST_CONFIG_DIR = join(process.cwd(), 'tests', 'config', 'fixtures');
const TEST_CONFIG_PATH = join(TEST_CONFIG_DIR, 'test-config.json');

describe('Config Loader', () => {
  beforeEach(async () => {
    await mkdir(TEST_CONFIG_DIR, { recursive: true });
  });

  afterEach(async () => {
    try {
      await unlink(TEST_CONFIG_PATH);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  it('should load valid config successfully', async () => {
    const validConfig: Config = {
      head_agent: {
        provider: 'anthropic',
        model: 'claude-sonnet-4',
      },
      reviewers: [
        {
          name: 'test-reviewer',
          provider: 'test',
          model: 'test-model',
          enabled: true,
          timeout: 300,
        },
      ],
      settings: {
        min_reviewers: 1,
        max_parallel: 5,
        output_format: 'json',
        default_timeout: 300,
      },
      supporters: {},
    };

    await writeFile(TEST_CONFIG_PATH, JSON.stringify(validConfig));

    const result = await loadConfig(TEST_CONFIG_PATH);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.head_agent.provider).toBe('anthropic');
      expect(result.data.reviewers).toHaveLength(1);
    }
  });

  it('should fail when config file does not exist', async () => {
    const result = await loadConfig('nonexistent-config.json');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('not found');
    }
  });

  it('should fail on invalid JSON', async () => {
    await writeFile(TEST_CONFIG_PATH, 'invalid json {]');

    const result = await loadConfig(TEST_CONFIG_PATH);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Invalid JSON');
    }
  });

  it('should fail when required fields are missing', async () => {
    const invalidConfig = {
      head_agent: {
        provider: 'anthropic',
        // missing model
      },
      reviewers: [],
    };

    await writeFile(TEST_CONFIG_PATH, JSON.stringify(invalidConfig));

    const result = await loadConfig(TEST_CONFIG_PATH);

    expect(result.success).toBe(false);
  });

  it('should apply default values', async () => {
    const minimalConfig = {
      head_agent: {
        provider: 'anthropic',
        model: 'claude-sonnet-4',
      },
      reviewers: [
        {
          name: 'test',
          provider: 'test',
          model: 'test-model',
        },
      ],
    };

    await writeFile(TEST_CONFIG_PATH, JSON.stringify(minimalConfig));

    const result = await loadConfig(TEST_CONFIG_PATH);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reviewers[0].enabled).toBe(true);
      expect(result.data.reviewers[0].timeout).toBe(300);
      expect(result.data.settings.min_reviewers).toBe(3);
      expect(result.data.settings.output_format).toBe('markdown');
    }
  });

  it('should warn when enabled reviewers < min_reviewers', async () => {
    const config = {
      head_agent: {
        provider: 'anthropic',
        model: 'claude-sonnet-4',
      },
      reviewers: [
        {
          name: 'reviewer-1',
          provider: 'test',
          model: 'test',
          enabled: true,
          timeout: 300,
        },
        {
          name: 'reviewer-2',
          provider: 'test',
          model: 'test',
          enabled: false,
          timeout: 300,
        },
      ],
      settings: {
        min_reviewers: 3,
        max_parallel: 5,
        output_format: 'json' as const,
        default_timeout: 300,
      },
      supporters: {},
    };

    await writeFile(TEST_CONFIG_PATH, JSON.stringify(config));

    // Should still succeed but with warning
    const result = await loadConfig(TEST_CONFIG_PATH);

    expect(result.success).toBe(true);
  });

  it('should return default config', () => {
    const defaultConfig = getDefaultConfig();

    expect(defaultConfig.head_agent).toBeDefined();
    expect(defaultConfig.reviewers.length).toBeGreaterThan(0);
    expect(defaultConfig.settings).toBeDefined();
  });
});
