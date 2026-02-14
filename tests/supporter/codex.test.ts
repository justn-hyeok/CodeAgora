import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CodexSupporter } from '../../src/supporter/codex.js';
import type { SupporterValidationRequest } from '../../src/supporter/types.js';

describe('Codex Supporter', () => {
  let codex: CodexSupporter;

  beforeEach(() => {
    codex = new CodexSupporter();
  });

  describe('Validation', () => {
    it('should validate type issues', async () => {
      const request: SupporterValidationRequest = {
        issue: {
          severity: 'MAJOR',
          category: 'type',
          line: 10,
          title: 'Type error',
          description: 'Type mismatch',
          suggestion: 'Fix types',
          confidence: 0.9,
        },
        file: 'test.ts',
        context: `
const x: string = 123; // Type error
        `.trim(),
      };

      const result = await codex.validate(request);

      expect(result.issue).toBe(request.issue);
      expect(result.validated).toBeDefined();
      expect(result.evidence).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should validate lint issues', async () => {
      const request: SupporterValidationRequest = {
        issue: {
          severity: 'MINOR',
          category: 'lint',
          line: 5,
          title: 'Lint warning',
          description: 'Unused variable',
          suggestion: 'Remove unused variable',
          confidence: 0.8,
        },
        file: 'test.ts',
        context: `
const unused = 'value';
console.log('hello');
        `.trim(),
      };

      const result = await codex.validate(request);

      expect(result.issue).toBe(request.issue);
      expect(result.validated).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should validate security issues', async () => {
      const request: SupporterValidationRequest = {
        issue: {
          severity: 'CRITICAL',
          category: 'security',
          line: 3,
          title: 'Security vulnerability',
          description: 'Unsafe eval usage',
          suggestion: 'Remove eval',
          confidence: 1.0,
        },
        file: 'test.js',
        context: `
const code = getUserInput();
eval(code); // Dangerous!
        `.trim(),
      };

      const result = await codex.validate(request);

      expect(result.issue).toBe(request.issue);
      expect(result.validated).toBeDefined();
      expect(result.evidence).toBeDefined();
    });

    it('should handle unsupported categories', async () => {
      const request: SupporterValidationRequest = {
        issue: {
          severity: 'MINOR',
          category: 'documentation',
          line: 1,
          title: 'Missing docs',
          description: 'Add documentation',
          suggestion: 'Add JSDoc',
          confidence: 0.7,
        },
        file: 'test.ts',
        context: 'function foo() {}',
      };

      const result = await codex.validate(request);

      expect(result.validated).toBe(false);
      expect(result.evidence).toContain('not supported');
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      const request: SupporterValidationRequest = {
        issue: {
          severity: 'MAJOR',
          category: 'type',
          line: 1,
          title: 'Error',
          description: 'Description',
          suggestion: 'Fix',
          confidence: 0.9,
        },
        file: '/nonexistent/path/test.ts',
        context: 'invalid typescript code :::',
      };

      const result = await codex.validate(request);

      // Should not throw, but return error result
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Confidence Scoring', () => {
    it('should provide high confidence for confirmed issues', async () => {
      const request: SupporterValidationRequest = {
        issue: {
          severity: 'CRITICAL',
          category: 'type',
          line: 1,
          title: 'Type error',
          description: 'Clear type mismatch',
          suggestion: 'Fix',
          confidence: 0.9,
        },
        file: 'test.ts',
        context: 'const x: number = "string";',
      };

      const result = await codex.validate(request);

      // High confidence expected for obvious type errors
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });
  });
});
