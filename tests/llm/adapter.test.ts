import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLLMAdapter } from '../../src/llm/adapter.js';
import type { LLMRequest } from '../../src/llm/types.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('LLM Adapter', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Anthropic Adapter', () => {
    it('should use native system parameter', async () => {
      const adapter = createLLMAdapter('anthropic', {
        apiKey: 'test-key',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: 'Response' }],
          usage: { input_tokens: 10, output_tokens: 20 },
        }),
      });

      const request: LLMRequest = {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet',
        systemPrompt: 'You are a code reviewer',
        prompt: 'Review this code',
      };

      await adapter.call(request);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      // Should use native system field
      expect(body.system).toBe('You are a code reviewer');
      expect(body.messages[0].content).toBe('Review this code');
      expect(body.messages[0].content).not.toContain('You are a code reviewer');
    });

    it('should handle API errors', async () => {
      const adapter = createLLMAdapter('anthropic', {
        apiKey: 'test-key',
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      const request: LLMRequest = {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet',
        prompt: 'Test',
      };

      const result = await adapter.call(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('401');
    });
  });

  describe('OpenAI Adapter', () => {
    it('should construct request correctly', async () => {
      const adapter = createLLMAdapter('openai', {
        apiKey: 'test-key',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
          usage: { prompt_tokens: 10, completion_tokens: 20 },
        }),
      });

      const request: LLMRequest = {
        provider: 'openai',
        model: 'gpt-4',
        systemPrompt: 'You are helpful',
        prompt: 'Hello',
      };

      await adapter.call(request);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[0].content).toBe('You are helpful');
      expect(body.messages[1].role).toBe('user');
      expect(body.messages[1].content).toBe('Hello');
    });
  });

  describe('Google Adapter', () => {
    it('should use systemInstruction field', async () => {
      const adapter = createLLMAdapter('google', {
        apiKey: 'test-key',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Response' }] } }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
        }),
      });

      const request: LLMRequest = {
        provider: 'google',
        model: 'gemini-2.0-flash',
        systemPrompt: 'You are a code reviewer',
        prompt: 'Review this',
      };

      await adapter.call(request);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      // Should use systemInstruction field
      expect(body.systemInstruction).toBeDefined();
      expect(body.systemInstruction.parts[0].text).toBe('You are a code reviewer');

      // User content should NOT contain system prompt
      expect(body.contents[0].parts[0].text).toBe('Review this');
      expect(body.contents[0].parts[0].text).not.toContain('You are a code reviewer');
    });
  });

  describe('xAI Adapter', () => {
    it('should construct request correctly', async () => {
      const adapter = createLLMAdapter('xai', {
        apiKey: 'test-key',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
          usage: { prompt_tokens: 10, completion_tokens: 20 },
        }),
      });

      const request: LLMRequest = {
        provider: 'xai',
        model: 'grok-beta',
        prompt: 'Test',
      };

      const result = await adapter.call(request);

      expect(result.success).toBe(true);
      expect(result.response).toBe('Response');
    });
  });

  describe('Minimax Adapter', () => {
    it('should handle timeout', async () => {
      const adapter = createLLMAdapter('minimax', {
        apiKey: 'test-key',
      });

      mockFetch.mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), 100);
          })
      );

      const request: LLMRequest = {
        provider: 'minimax',
        model: 'minimax-m2.5',
        prompt: 'Test',
        timeout: 50,
      };

      const result = await adapter.call(request);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Kimi Adapter', () => {
    it('should return usage stats', async () => {
      const adapter = createLLMAdapter('kimi', {
        apiKey: 'test-key',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
          usage: { prompt_tokens: 100, completion_tokens: 50 },
        }),
      });

      const request: LLMRequest = {
        provider: 'kimi',
        model: 'kimi-k2.5',
        prompt: 'Test',
      };

      const result = await adapter.call(request);

      expect(result.success).toBe(true);
      expect(result.usage).toEqual({
        inputTokens: 100,
        outputTokens: 50,
      });
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Factory Function', () => {
    it('should throw error for unsupported provider', () => {
      expect(() =>
        createLLMAdapter('invalid' as any, { apiKey: 'test' })
      ).toThrow('Unsupported provider');
    });
  });
});
