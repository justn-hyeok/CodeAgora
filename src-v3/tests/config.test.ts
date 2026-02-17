/**
 * Config Loader Tests
 */

import { describe, it, expect } from 'vitest';
import { validateConfigData, getEnabledReviewers, checkMinReviewers } from '../config/loader.js';
import type { Config } from '../types/config.js';

describe('Config Validation', () => {
  const validConfig: Config = {
    reviewers: [
      {
        id: 'r1',
        backend: 'opencode',
        provider: 'kimi',
        model: 'kimi-k2.5',
        enabled: true,
        timeout: 120,
      },
      {
        id: 'r2',
        backend: 'codex',
        model: 'o4-mini',
        enabled: true,
        timeout: 120,
      },
      {
        id: 'r3',
        backend: 'gemini',
        model: 'gemini-flash',
        enabled: false,
        timeout: 120,
      },
    ],
    supporters: [
      {
        id: 's1',
        backend: 'codex',
        model: 'o4-mini',
        role: '검증자',
        enabled: true,
      },
    ],
    moderator: {
      backend: 'codex',
      model: 'claude-sonnet',
    },
    discussion: {
      maxRounds: 3,
      registrationThreshold: {
        HARSHLY_CRITICAL: 1,
        CRITICAL: 1,
        WARNING: 2,
        SUGGESTION: null,
      },
      codeSnippetRange: 10,
    },
    errorHandling: {
      maxRetries: 2,
      forfeitThreshold: 0.7,
    },
  };

  it('should validate valid config', () => {
    expect(() => validateConfigData(validConfig)).not.toThrow();
  });

  it('should reject invalid backend', () => {
    const invalidConfig = {
      ...validConfig,
      reviewers: [
        {
          ...validConfig.reviewers[0],
          backend: 'invalid',
        },
      ],
    };

    expect(() => validateConfigData(invalidConfig)).toThrow();
  });

  it('should get enabled reviewers', () => {
    const enabled = getEnabledReviewers(validConfig);
    expect(enabled).toHaveLength(2);
    expect(enabled.map((r) => r.id)).toEqual(['r1', 'r2']);
  });

  it('should check minimum reviewers', () => {
    const result = checkMinReviewers(validConfig, 2);
    expect(result.valid).toBe(true);

    const failResult = checkMinReviewers(validConfig, 5);
    expect(failResult.valid).toBe(false);
    expect(failResult.message).toContain('Insufficient reviewers');
  });
});
