import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getProviderConfig, getConfiguredProviders, getEnvVarName } from '../../src/llm/config.js';
import type { Provider } from '../../src/llm/types.js';

describe('LLM Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getEnvVarName', () => {
    it('should return correct env var names', () => {
      expect(getEnvVarName('anthropic')).toBe('ANTHROPIC_API_KEY');
      expect(getEnvVarName('openai')).toBe('OPENAI_API_KEY');
      expect(getEnvVarName('google')).toBe('GOOGLE_API_KEY');
      expect(getEnvVarName('xai')).toBe('XAI_API_KEY');
      expect(getEnvVarName('minimax')).toBe('MINIMAX_API_KEY');
      expect(getEnvVarName('kimi')).toBe('KIMI_API_KEY');
    });
  });

  describe('getProviderConfig', () => {
    it('should load API key from environment', () => {
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

      const config = getProviderConfig('anthropic');

      expect(config.apiKey).toBe('test-anthropic-key');
      expect(config.baseUrl).toBeUndefined();
    });

    it('should load custom base URL if set', () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';
      process.env.OPENAI_BASE_URL = 'https://custom.openai.com';

      const config = getProviderConfig('openai');

      expect(config.apiKey).toBe('test-openai-key');
      expect(config.baseUrl).toBe('https://custom.openai.com');
    });

    it('should throw error if API key not found', () => {
      delete process.env.GOOGLE_API_KEY;

      expect(() => getProviderConfig('google')).toThrow(/API key not found/);
      expect(() => getProviderConfig('google')).toThrow(/GOOGLE_API_KEY/);
    });
  });

  describe('getConfiguredProviders', () => {
    it('should return empty array when no keys configured', () => {
      // Clear all API keys
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.GOOGLE_API_KEY;
      delete process.env.XAI_API_KEY;
      delete process.env.MINIMAX_API_KEY;
      delete process.env.KIMI_API_KEY;

      const providers = getConfiguredProviders();

      expect(providers).toEqual([]);
    });

    it('should return only configured providers', () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.GOOGLE_API_KEY;
      delete process.env.XAI_API_KEY;
      delete process.env.MINIMAX_API_KEY;
      delete process.env.KIMI_API_KEY;

      process.env.ANTHROPIC_API_KEY = 'test-key-1';
      process.env.GOOGLE_API_KEY = 'test-key-2';

      const providers = getConfiguredProviders();

      expect(providers).toHaveLength(2);
      expect(providers).toContain('anthropic');
      expect(providers).toContain('google');
      expect(providers).not.toContain('openai');
    });

    it('should return all providers when all keys set', () => {
      process.env.ANTHROPIC_API_KEY = 'key1';
      process.env.OPENAI_API_KEY = 'key2';
      process.env.GOOGLE_API_KEY = 'key3';
      process.env.XAI_API_KEY = 'key4';
      process.env.MINIMAX_API_KEY = 'key5';
      process.env.KIMI_API_KEY = 'key6';

      const providers = getConfiguredProviders();

      expect(providers).toHaveLength(6);
      const allProviders: Provider[] = ['anthropic', 'openai', 'google', 'xai', 'minimax', 'kimi'];
      for (const provider of allProviders) {
        expect(providers).toContain(provider);
      }
    });
  });
});
