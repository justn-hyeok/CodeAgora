/**
 * CLI Review Options & Formatters Tests
 */

import { describe, it, expect } from 'vitest';
import {
  formatText,
  formatJson,
  formatMarkdown,
  formatGithub,
  formatOutput,
} from '../cli/formatters/review-output.js';
import {
  parseReviewerOption,
  isStdinPiped,
} from '../cli/options/review-options.js';
import type { PipelineResult } from '../pipeline/orchestrator.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const successResult: PipelineResult = {
  status: 'success',
  sessionId: '001',
  date: '2026-03-13',
};

const errorResult: PipelineResult = {
  status: 'error',
  sessionId: '002',
  date: '2026-03-13',
  error: 'All reviewers failed',
};

// ---------------------------------------------------------------------------
// formatText
// ---------------------------------------------------------------------------

describe('formatText', () => {
  it('should format success result', () => {
    const output = formatText(successResult);
    expect(output).toContain('Review complete!');
    expect(output).toContain('2026-03-13/001');
  });

  it('should format error result', () => {
    const output = formatText(errorResult);
    expect(output).toContain('Review failed');
    expect(output).toContain('All reviewers failed');
  });
});

// ---------------------------------------------------------------------------
// formatJson
// ---------------------------------------------------------------------------

describe('formatJson', () => {
  it('should return valid JSON', () => {
    const output = formatJson(successResult);
    const parsed = JSON.parse(output);
    expect(parsed.status).toBe('success');
    expect(parsed.sessionId).toBe('001');
  });

  it('should include error field for error result', () => {
    const output = formatJson(errorResult);
    const parsed = JSON.parse(output);
    expect(parsed.error).toBe('All reviewers failed');
  });
});

// ---------------------------------------------------------------------------
// formatMarkdown
// ---------------------------------------------------------------------------

describe('formatMarkdown', () => {
  it('should contain markdown header', () => {
    const output = formatMarkdown(successResult);
    expect(output).toContain('## CodeAgora Review');
  });

  it('should contain session info', () => {
    const output = formatMarkdown(successResult);
    expect(output).toContain('2026-03-13/001');
  });

  it('should format error with Error prefix', () => {
    const output = formatMarkdown(errorResult);
    expect(output).toContain('**Error:**');
  });
});

// ---------------------------------------------------------------------------
// formatGithub
// ---------------------------------------------------------------------------

describe('formatGithub', () => {
  it('should contain emoji header', () => {
    const output = formatGithub(successResult);
    expect(output).toContain('🔍 CodeAgora Review');
  });

  it('should contain severity section headers', () => {
    const output = formatGithub(successResult);
    expect(output).toContain('CRITICAL');
    expect(output).toContain('WARNING');
  });

  it('should format error with ❌', () => {
    const output = formatGithub(errorResult);
    expect(output).toContain('❌');
  });
});

// ---------------------------------------------------------------------------
// formatOutput dispatcher
// ---------------------------------------------------------------------------

describe('formatOutput', () => {
  it('should dispatch to text formatter', () => {
    const output = formatOutput(successResult, 'text');
    expect(output).toContain('Review complete!');
  });

  it('should dispatch to json formatter', () => {
    const output = formatOutput(successResult, 'json');
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('should dispatch to md formatter', () => {
    const output = formatOutput(successResult, 'md');
    expect(output).toContain('## CodeAgora Review');
  });

  it('should dispatch to github formatter', () => {
    const output = formatOutput(successResult, 'github');
    expect(output).toContain('🔍');
  });
});

// ---------------------------------------------------------------------------
// parseReviewerOption
// ---------------------------------------------------------------------------

describe('parseReviewerOption', () => {
  it('should parse numeric value as count', () => {
    const result = parseReviewerOption('3');
    expect(result).toEqual({ count: 3 });
  });

  it('should parse large number as count', () => {
    const result = parseReviewerOption('10');
    expect(result).toEqual({ count: 10 });
  });

  it('should parse comma-separated names', () => {
    const result = parseReviewerOption('r1-kimi,r2-deepseek');
    expect(result).toEqual({ names: ['r1-kimi', 'r2-deepseek'] });
  });

  it('should parse single name', () => {
    const result = parseReviewerOption('r1-kimi');
    expect(result).toEqual({ names: ['r1-kimi'] });
  });

  it('should trim whitespace in names', () => {
    const result = parseReviewerOption(' r1-kimi , r2-deepseek ');
    expect(result).toEqual({ names: ['r1-kimi', 'r2-deepseek'] });
  });

  it('should throw on empty string', () => {
    expect(() => parseReviewerOption('')).toThrow('cannot be empty');
  });

  it('should throw on zero count', () => {
    expect(() => parseReviewerOption('0')).toThrow('must be >= 1');
  });

  it('should throw on mixed numeric in names list', () => {
    expect(() => parseReviewerOption('r1-kimi,3')).toThrow('numeric entry');
  });
});

// ---------------------------------------------------------------------------
// isStdinPiped
// ---------------------------------------------------------------------------

describe('isStdinPiped', () => {
  it('should return a boolean', () => {
    expect(typeof isStdinPiped()).toBe('boolean');
  });
});
