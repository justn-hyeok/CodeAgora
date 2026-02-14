import { describe, it, expect } from 'vitest';
import { MockBackend, OpenCodeBackend, createBackend } from '../../src/reviewer/adapter.js';
import type { Reviewer } from '../../src/config/schema.js';
import type { ReviewRequest } from '../../src/reviewer/types.js';

describe('Reviewer Adapter', () => {
  const mockReviewer: Reviewer = {
    name: 'test-reviewer',
    provider: 'openai',
    model: 'gpt-4',
    enabled: true,
    timeout: 300,
  };

  const mockRequest: ReviewRequest = {
    chunk: {
      file: 'test.ts',
      lineRange: [1, 10],
      content: 'sample diff content',
      language: 'typescript',
    },
    systemPrompt: 'You are a code reviewer',
    userPrompt: 'Review this code',
  };

  describe('MockBackend', () => {
    it('should execute and return a successful mock review', async () => {
      const backend = new MockBackend();
      const result = await backend.execute(mockReviewer, mockRequest);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.response).toContain('Mock review issue');
        expect(result.response).toContain(mockReviewer.name);
      }
    });

    it('should return response in expected format', async () => {
      const backend = new MockBackend();
      const result = await backend.execute(mockReviewer, mockRequest);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.response).toContain('[MINOR]');
        expect(result.response).toContain('confidence:');
      }
    });

    it('should not use reviewer name in file paths', async () => {
      const maliciousReviewer: Reviewer = {
        name: 'test;rm-rf',
        provider: 'openai',
        model: 'gpt-4',
        enabled: true,
        timeout: 300,
      };

      const backend = new MockBackend();
      const result = await backend.execute(maliciousReviewer, mockRequest);

      // Should succeed because we use crypto.randomUUID, not reviewer.name for file paths
      expect(result.success).toBe(true);
    });
  });

  describe('OpenCodeBackend', () => {
    it('should return error when API key not configured or API error', async () => {
      const backend = new OpenCodeBackend();
      const result = await backend.execute(mockReviewer, mockRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        // Should fail with either missing API key or API error (if key exists but invalid)
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
        expect(result.error.length).toBeGreaterThan(0);
      }
    });
  });

  describe('createBackend', () => {
    it('should create MockBackend by default', () => {
      const backend = createBackend();
      expect(backend).toBeInstanceOf(MockBackend);
    });

    it('should create MockBackend when specified', () => {
      const backend = createBackend('mock');
      expect(backend).toBeInstanceOf(MockBackend);
    });

    it('should create OpenCodeBackend when specified', () => {
      const backend = createBackend('opencode');
      expect(backend).toBeInstanceOf(OpenCodeBackend);
    });
  });
});
