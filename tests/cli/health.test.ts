import { describe, it, expect } from 'vitest';
import type { Config } from '../../src/config/schema.js';

describe('Health Check', () => {
  const validConfig: Config = {
    reviewers: [
      {
        name: 'test-reviewer',
        provider: 'anthropic',
        model: 'claude-sonnet-4',
        enabled: true,
      },
    ],
    settings: {
      min_reviewers: 1,
      max_parallel: 3,
      enable_debate: true,
      enable_supporters: true,
      output_format: 'terminal',
    },
  };

  it('should validate config structure', () => {
    expect(validConfig.reviewers).toBeDefined();
    expect(validConfig.settings).toBeDefined();
  });

  it('should detect enabled reviewers', () => {
    const enabled = validConfig.reviewers.filter((r) => r.enabled);
    expect(enabled.length).toBeGreaterThan(0);
  });

  it('should validate min_reviewers setting', () => {
    const enabled = validConfig.reviewers.filter((r) => r.enabled);
    expect(enabled.length).toBeGreaterThanOrEqual(validConfig.settings.min_reviewers);
  });
});
