import { describe, it, expect } from 'vitest';
import { parseIssueBlock, parseReviewerResponse } from '../../src/parser/regex-parser.js';

describe('Regex Parser', () => {
  describe('parseIssueBlock', () => {
    it('should parse complete issue block', () => {
      const block = `[CRITICAL] security | 42 | SQL Injection vulnerability
User input is directly concatenated into SQL query
suggestion: Use parameterized queries
confidence: 0.95`;

      const result = parseIssueBlock(block);

      expect(result.issue).toBeTruthy();
      expect(result.issue?.severity).toBe('CRITICAL');
      expect(result.issue?.category).toBe('security');
      expect(result.issue?.line).toBe(42);
      expect(result.issue?.title).toBe('SQL Injection vulnerability');
      expect(result.issue?.description).toContain('User input');
      expect(result.issue?.suggestion).toContain('parameterized');
      expect(result.issue?.confidence).toBe(0.95);
    });

    it('should parse issue with line range', () => {
      const block = `[MAJOR] performance | 10-15 | Inefficient loop
This loop has O(n²) complexity`;

      const result = parseIssueBlock(block);

      expect(result.issue?.line).toBe(10);
      expect(result.issue?.lineEnd).toBe(15);
    });

    it('should handle missing confidence with default', () => {
      const block = `[MINOR] style | 5 | Inconsistent naming`;

      const result = parseIssueBlock(block);

      expect(result.issue?.confidence).toBe(0.5);
    });

    it('should normalize severity typos', () => {
      const block = `[critical] security | 1 | Issue`;

      const result = parseIssueBlock(block);

      expect(result.issue?.severity).toBe('CRITICAL');
    });

    it('should fallback to MINOR for unknown severity', () => {
      const block = `[UNKNOWN] category | 1 | Issue`;

      const result = parseIssueBlock(block);

      expect(result.issue?.severity).toBe('MINOR');
    });

    it('should handle missing description', () => {
      const block = `[SUGGESTION] style | 20 | Use const instead of let`;

      const result = parseIssueBlock(block);

      expect(result.issue?.title).toBe('Use const instead of let');
      expect(result.issue?.description).toBeUndefined();
    });

    it('should handle missing suggestion', () => {
      const block = `[MAJOR] logic | 30 | Null pointer exception
This can crash the application`;

      const result = parseIssueBlock(block);

      expect(result.issue?.suggestion).toBeUndefined();
    });

    it('should handle line number with L prefix', () => {
      const block = `[MINOR] style | L25 | Issue title`;

      const result = parseIssueBlock(block);

      expect(result.issue?.line).toBe(25);
    });

    it('should handle line range with L prefix', () => {
      const block = `[MAJOR] logic | L10-L20 | Issue title`;

      const result = parseIssueBlock(block);

      expect(result.issue?.line).toBe(10);
      expect(result.issue?.lineEnd).toBe(20);
    });

    it('should fail on invalid format', () => {
      const block = `This is just random text without proper format`;

      const result = parseIssueBlock(block);

      expect(result.issue).toBeNull();
      expect(result.parseError).toBeTruthy();
    });

    it('should clamp confidence values', () => {
      const block1 = `[MINOR] style | 1 | Issue
confidence: 1.5`;

      const result1 = parseIssueBlock(block1);
      expect(result1.issue?.confidence).toBe(1.0);

      const block2 = `[MINOR] style | 1 | Issue
confidence: -0.5`;

      const result2 = parseIssueBlock(block2);
      expect(result2.issue?.confidence).toBe(0.0);
    });
  });

  describe('parseReviewerResponse', () => {
    it('should parse multiple issues', () => {
      const response = `[CRITICAL] security | 10 | SQL Injection
Use parameterized queries

[MAJOR] performance | 20 | N+1 query problem
suggestion: Use batch loading
confidence: 0.8

[MINOR] style | 30 | Inconsistent naming`;

      const blocks = parseReviewerResponse(response);

      expect(blocks).toHaveLength(3);
      expect(blocks[0].issue?.severity).toBe('CRITICAL');
      expect(blocks[1].issue?.severity).toBe('MAJOR');
      expect(blocks[2].issue?.severity).toBe('MINOR');
    });

    it('should handle "no issues found" response', () => {
      const response = 'No issues found.';

      const blocks = parseReviewerResponse(response);

      expect(blocks).toHaveLength(0);
    });

    it('should handle empty response', () => {
      const blocks = parseReviewerResponse('');

      expect(blocks).toHaveLength(0);
    });

    it('should handle completely unstructured response', () => {
      const response = 'This code looks good but I have some concerns...';

      const blocks = parseReviewerResponse(response);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].issue).toBeNull();
      expect(blocks[0].parseError).toContain('No structured issue blocks');
    });

    it('should handle mix of valid and invalid blocks', () => {
      const response = `[CRITICAL] security | 10 | Valid issue

Some random text that doesn't match the pattern

[MAJOR] logic | 20 | Another valid issue`;

      const blocks = parseReviewerResponse(response);

      const validIssues = blocks.filter((b) => b.issue !== null);
      expect(validIssues).toHaveLength(2);
    });

    it('should preserve raw text for failed parsing', () => {
      const response = `Invalid issue format
Without proper structure`;

      const blocks = parseReviewerResponse(response);

      expect(blocks[0].raw).toContain('Invalid issue format');
      expect(blocks[0].parseError).toBeTruthy();
    });

    it('should handle issues with complex descriptions', () => {
      const response = `[CRITICAL] security | 5 | XSS vulnerability
The user input is rendered without sanitization.
This could allow attackers to inject malicious scripts.

Example:
<script>alert('xss')</script>

suggestion: Use a sanitization library like DOMPurify
confidence: 0.9`;

      const blocks = parseReviewerResponse(response);

      expect(blocks[0].issue?.description).toContain('user input');
      expect(blocks[0].issue?.description).toContain('Example');
      expect(blocks[0].issue?.suggestion).toContain('DOMPurify');
    });
  });
});
