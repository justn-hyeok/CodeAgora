import { describe, it, expect, beforeEach } from 'vitest';
import { GeminiSupporter } from '../../src/supporter/gemini.js';
import type { SupporterValidationRequest } from '../../src/supporter/types.js';

describe('Gemini Supporter', () => {
  let gemini: GeminiSupporter;

  beforeEach(() => {
    gemini = new GeminiSupporter();
  });

  describe('Validation', () => {
    it('should use LLM for validation', async () => {
      const request: SupporterValidationRequest = {
        issue: {
          severity: 'MAJOR',
          category: 'logic',
          line: 10,
          title: 'Logic error',
          description: 'Incorrect condition',
          suggestion: 'Fix condition',
          confidence: 0.8,
        },
        file: 'test.ts',
        context: `
if (user.age < 18) {
  allowAccess(); // Should be deny
}
        `.trim(),
      };

      const result = await gemini.validate(request);

      expect(result.issue).toBe(request.issue);
      expect(result.validated).toBeDefined();
      expect(typeof result.validated).toBe('boolean');
      expect(result.evidence).toBeDefined();
      expect(typeof result.evidence).toBe('string');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should handle any category', async () => {
      const request: SupporterValidationRequest = {
        issue: {
          severity: 'MINOR',
          category: 'performance',
          line: 5,
          title: 'Performance issue',
          description: 'Inefficient loop',
          suggestion: 'Optimize',
          confidence: 0.7,
        },
        file: 'test.ts',
        context: `
for (let i = 0; i < array.length; i++) {
  // Recalculates length each iteration
}
        `.trim(),
      };

      const result = await gemini.validate(request);

      expect(result).toBeDefined();
      expect(result.validated).toBeDefined();
    });
  });

  describe('Response Parsing', () => {
    it('should parse VALIDATED field', async () => {
      const request: SupporterValidationRequest = {
        issue: {
          severity: 'MAJOR',
          category: 'logic',
          line: 1,
          title: 'Issue',
          description: 'Description',
          suggestion: 'Fix',
          confidence: 0.8,
        },
        file: 'test.ts',
        context: 'code',
      };

      const result = await gemini.validate(request);

      expect(typeof result.validated).toBe('boolean');
    });

    it('should parse EVIDENCE field', async () => {
      const request: SupporterValidationRequest = {
        issue: {
          severity: 'MINOR',
          category: 'style',
          line: 1,
          title: 'Style',
          description: 'Description',
          suggestion: 'Fix',
          confidence: 0.6,
        },
        file: 'test.ts',
        context: 'code',
      };

      const result = await gemini.validate(request);

      expect(result.evidence).toBeDefined();
      expect(result.evidence.length).toBeGreaterThan(0);
    });

    it('should parse CONFIDENCE field', async () => {
      const request: SupporterValidationRequest = {
        issue: {
          severity: 'MAJOR',
          category: 'security',
          line: 1,
          title: 'Security',
          description: 'Description',
          suggestion: 'Fix',
          confidence: 0.9,
        },
        file: 'test.ts',
        context: 'code',
      };

      const result = await gemini.validate(request);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors', async () => {
      const request: SupporterValidationRequest = {
        issue: {
          severity: 'MAJOR',
          category: 'logic',
          line: 1,
          title: 'Error',
          description: 'Description',
          suggestion: 'Fix',
          confidence: 0.8,
        },
        file: 'test.ts',
        context: 'code',
      };

      // Even if OpenCode fails, should return error result, not throw
      const result = await gemini.validate(request);

      expect(result).toBeDefined();
      expect(result.issue).toBe(request.issue);
    });
  });
});
