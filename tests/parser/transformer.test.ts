import { describe, it, expect, vi } from 'vitest';
import { transformReviewerResponse } from '../../src/parser/transformer.js';
import * as regexParser from '../../src/parser/regex-parser.js';

describe('Parser Transformer', () => {
  describe('transformReviewerResponse', () => {
    it('should transform valid reviewer response into ParsedReview', () => {
      const response = `[CRITICAL] security | 10 | SQL Injection
Use parameterized queries
suggestion: Use prepared statements
confidence: 0.9

[MAJOR] performance | 20 | N+1 query
Batch load data
confidence: 0.8`;

      const result = transformReviewerResponse('reviewer-1', 'src/test.ts', response);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.review.reviewer).toBe('reviewer-1');
        expect(result.review.file).toBe('src/test.ts');
        expect(result.review.issues).toHaveLength(2);
        expect(result.review.parseFailures).toHaveLength(0);
        expect(result.review.issues[0].severity).toBe('CRITICAL');
        expect(result.review.issues[1].severity).toBe('MAJOR');
      }
    });

    it('should handle response with only valid issues', () => {
      const response = `[MINOR] style | 5 | Use const instead of let`;

      const result = transformReviewerResponse('r2', 'app.js', response);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.review.issues).toHaveLength(1);
        expect(result.review.parseFailures).toHaveLength(0);
      }
    });

    it('should preserve parse failures without discarding them', () => {
      const response = `[CRITICAL] security | 10 | Valid issue

[MAJOR] logic | 20 | Another valid issue`;

      const result = transformReviewerResponse('r3', 'code.py', response);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.review.issues).toHaveLength(2);
        // No parse failures because unstructured text between blocks is ignored
        expect(result.review.parseFailures).toHaveLength(0);
      }
    });

    it('should handle response with all parse failures', () => {
      const response = `This is completely unstructured text
without any proper issue format
just random content`;

      const result = transformReviewerResponse('r4', 'broken.ts', response);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.review.issues).toHaveLength(0);
        expect(result.review.parseFailures).toHaveLength(1);
        expect(result.review.parseFailures[0].raw).toContain('unstructured');
      }
    });

    it('should handle empty response', () => {
      const result = transformReviewerResponse('r5', 'empty.js', '');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.review.issues).toHaveLength(0);
        expect(result.review.parseFailures).toHaveLength(0);
      }
    });

    it('should handle "no issues found" response', () => {
      const result = transformReviewerResponse('r6', 'clean.ts', 'No issues found.');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.review.issues).toHaveLength(0);
        expect(result.review.parseFailures).toHaveLength(0);
      }
    });

    it('should include parseError reason when block fails to parse', () => {
      const response = `[INVALID-SEVERITY] category | line | Title`;

      const result = transformReviewerResponse('r7', 'file.ts', response);

      expect(result.success).toBe(true);
      if (result.success) {
        // Should have parse failure with reason
        expect(result.review.parseFailures.length).toBeGreaterThan(0);
        expect(result.review.parseFailures[0].reason).toBeTruthy();
        expect(result.review.parseFailures[0].raw).toContain('INVALID-SEVERITY');
      }
    });

    it('should handle exception from parseReviewerResponse', () => {
      const spy = vi.spyOn(regexParser, 'parseReviewerResponse');
      spy.mockImplementation(() => {
        throw new Error('Parsing exploded');
      });

      const result = transformReviewerResponse('r8', 'crash.ts', 'some response');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Failed to transform response');
        expect(result.error).toContain('Parsing exploded');
      }

      spy.mockRestore();
    });

    it('should handle non-Error exceptions', () => {
      const spy = vi.spyOn(regexParser, 'parseReviewerResponse');
      spy.mockImplementation(() => {
        throw 'String error';
      });

      const result = transformReviewerResponse('r9', 'string-error.ts', 'response');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Failed to transform response');
        expect(result.error).toContain('String error');
      }

      spy.mockRestore();
    });

    it('should correctly filter issues from blocks', () => {
      const response = `[CRITICAL] security | 1 | Issue 1
[MAJOR] logic | 2 | Issue 2
[MINOR] style | 3 | Issue 3`;

      const result = transformReviewerResponse('r10', 'mixed.ts', response);

      expect(result.success).toBe(true);
      if (result.success) {
        // Should have 3 valid issues
        expect(result.review.issues).toHaveLength(3);
        expect(result.review.issues.every((i) => i.severity)).toBe(true);

        // No parse failures - unstructured text between blocks is ignored
        expect(result.review.parseFailures).toHaveLength(0);
      }
    });

    it('should handle parse failures with missing parseError field', () => {
      const spy = vi.spyOn(regexParser, 'parseReviewerResponse');
      spy.mockImplementation(() => [
        {
          raw: 'Some raw text',
          issue: null,
          parseError: undefined, // Missing parseError
        },
      ]);

      const result = transformReviewerResponse('r11', 'no-error.ts', 'response');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.review.parseFailures).toHaveLength(1);
        expect(result.review.parseFailures[0].reason).toBe('Unknown parsing error');
      }

      spy.mockRestore();
    });

    it('should preserve all metadata in ParsedReview', () => {
      const response = `[CRITICAL] security | 42 | XSS vulnerability`;

      const result = transformReviewerResponse('security-bot', 'auth.ts', response);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.review.reviewer).toBe('security-bot');
        expect(result.review.file).toBe('auth.ts');
        expect(result.review.issues[0].line).toBe(42);
        expect(result.review.issues[0].category).toBe('security');
        expect(result.review.issues[0].title).toBe('XSS vulnerability');
      }
    });

    it('should handle complex multi-issue response', () => {
      const response = `[CRITICAL] security | 10-15 | Authentication bypass
Detailed description of the issue
suggestion: Add proper auth checks
confidence: 0.95

[MAJOR] performance | 30 | Inefficient algorithm
O(n²) complexity detected
suggestion: Use hash map
confidence: 0.85

[MINOR] style | 50 | Naming convention
confidence: 0.6

[SUGGESTION] maintainability | 70 | Add comments
suggestion: Document complex logic`;

      const result = transformReviewerResponse('comprehensive-reviewer', 'app.ts', response);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.review.issues).toHaveLength(4);
        // No parse failures - unstructured text is ignored
        expect(result.review.parseFailures).toHaveLength(0);

        // Verify line ranges
        expect(result.review.issues[0].line).toBe(10);
        expect(result.review.issues[0].lineEnd).toBe(15);

        // Verify severities
        expect(result.review.issues[0].severity).toBe('CRITICAL');
        expect(result.review.issues[1].severity).toBe('MAJOR');
        expect(result.review.issues[2].severity).toBe('MINOR');
        expect(result.review.issues[3].severity).toBe('SUGGESTION');
      }
    });
  });
});
