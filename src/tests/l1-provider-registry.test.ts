/**
 * Provider Registry Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createGroq } from '@ai-sdk/groq';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { getModel, getSupportedProviders, clearProviderCache } from '@codeagora/core/l1/provider-registry.js';

// Mock all provider packages
vi.mock('@ai-sdk/groq', () => ({
  createGroq: vi.fn(() => {
    const provider = (modelId: string) => ({ modelId, provider: 'groq' });
    return provider;
  }),
}));

vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: vi.fn(() => {
    const provider = (modelId: string) => ({ modelId, provider: 'openai-compatible' });
    return provider;
  }),
}));

vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: vi.fn(() => {
    const provider = (modelId: string) => ({ modelId, provider: 'openrouter' });
    return provider;
  }),
}));

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => {
    const provider = (modelId: string) => ({ modelId, provider: 'google' });
    return provider;
  }),
}));

vi.mock('@ai-sdk/fireworks', () => ({
  createFireworks: vi.fn(() => {
    const provider = (modelId: string) => ({ modelId, provider: 'fireworks' });
    return provider;
  }),
}));

vi.mock('@ai-sdk/cohere', () => ({
  createCohere: vi.fn(() => {
    const provider = (modelId: string) => ({ modelId, provider: 'cohere' });
    return provider;
  }),
}));

vi.mock('@ai-sdk/deepinfra', () => ({
  createDeepInfra: vi.fn(() => {
    const provider = (modelId: string) => ({ modelId, provider: 'deepinfra' });
    return provider;
  }),
}));

vi.mock('@ai-sdk/moonshotai', () => ({
  createMoonshotAI: vi.fn(() => {
    const provider = (modelId: string) => ({ modelId, provider: 'moonshot' });
    return provider;
  }),
}));

vi.mock('@ai-sdk/perplexity', () => ({
  createPerplexity: vi.fn(() => {
    const provider = (modelId: string) => ({ modelId, provider: 'perplexity' });
    return provider;
  }),
}));

vi.mock('@ai-sdk/huggingface', () => ({
  createHuggingFace: vi.fn(() => {
    const provider = (modelId: string) => ({ modelId, provider: 'huggingface' });
    return provider;
  }),
}));

vi.mock('@ai-sdk/baseten', () => ({
  createBaseten: vi.fn(() => {
    const provider = (modelId: string) => ({ modelId, provider: 'baseten' });
    return provider;
  }),
}));

const mockCreateGroq = vi.mocked(createGroq);

describe('Provider Registry', () => {
  beforeEach(() => {
    clearProviderCache();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('getSupportedProviders', () => {
    it('should return all supported provider names', () => {
      const providers = getSupportedProviders();
      expect(providers).toContain('groq');
      expect(providers).toContain('nvidia-nim');
      expect(providers).toContain('openrouter');
      expect(providers).toContain('google');
      expect(providers).toContain('mistral');
      expect(providers).toContain('cerebras');
      expect(providers).toContain('together');
      expect(providers).toContain('xai');
      expect(providers).toContain('fireworks');
      expect(providers).toContain('cohere');
      expect(providers).toContain('deepinfra');
      expect(providers).toContain('moonshot');
      expect(providers).toContain('perplexity');
      expect(providers).toContain('huggingface');
      expect(providers).toContain('baseten');
      expect(providers).toContain('siliconflow');
      expect(providers).toContain('novita');
      expect(providers.length).toBeGreaterThanOrEqual(24);
    });
  });

  describe('getModel', () => {
    it('should create a groq model when API key is set', () => {
      vi.stubEnv('GROQ_API_KEY', 'test-key');
      const model = getModel('groq', 'llama-3.3-70b-versatile');
      expect(model).toBeDefined();
      expect((model as any).modelId).toBe('llama-3.3-70b-versatile');
    });

    it('should create a nvidia-nim model when API key is set', () => {
      vi.stubEnv('NVIDIA_API_KEY', 'test-key');
      const model = getModel('nvidia-nim', 'deepseek-r1');
      expect(model).toBeDefined();
      expect((model as any).modelId).toBe('deepseek-r1');
    });

    it('should create an openrouter model when API key is set', () => {
      vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
      const model = getModel('openrouter', 'anthropic/claude-3.5-sonnet');
      expect(model).toBeDefined();
      expect((model as any).modelId).toBe('anthropic/claude-3.5-sonnet');
    });

    it('should throw for unknown provider', () => {
      expect(() => getModel('unknown-provider', 'model'))
        .toThrow(/Unknown API provider: 'unknown-provider'/);
    });

    it('should throw when API key is missing', () => {
      // Ensure env var is not set
      delete process.env.GROQ_API_KEY;
      expect(() => getModel('groq', 'model'))
        .toThrow(/Set GROQ_API_KEY environment variable/);
    });

    it('should cache provider instances', () => {
      vi.stubEnv('GROQ_API_KEY', 'test-key');
      getModel('groq', 'model-a');
      getModel('groq', 'model-b');

      // createGroq should only be called once (cached)
      expect(mockCreateGroq).toHaveBeenCalledTimes(1);
    });

    it('should create fresh instances after cache clear', () => {
      vi.stubEnv('GROQ_API_KEY', 'test-key');
      getModel('groq', 'model-a');
      clearProviderCache();
      getModel('groq', 'model-b');

      expect(mockCreateGroq).toHaveBeenCalledTimes(2);
    });

    // --- Google (#1) ---
    it('should create a google model when API key is set', () => {
      vi.stubEnv('GOOGLE_API_KEY', 'test-key');
      const model = getModel('google', 'gemini-2.5-flash');
      expect(model).toBeDefined();
      expect((model as any).modelId).toBe('gemini-2.5-flash');
    });

    it('should throw when GOOGLE_API_KEY is missing', () => {
      delete process.env.GOOGLE_API_KEY;
      expect(() => getModel('google', 'gemini-2.5-pro'))
        .toThrow(/Set GOOGLE_API_KEY environment variable/);
    });

    // --- Mistral (#2) ---
    it('should create a mistral model when API key is set', () => {
      vi.stubEnv('MISTRAL_API_KEY', 'test-key');
      const model = getModel('mistral', 'mistral-large-latest');
      expect(model).toBeDefined();
      expect((model as any).modelId).toBe('mistral-large-latest');
    });

    it('should throw when MISTRAL_API_KEY is missing', () => {
      delete process.env.MISTRAL_API_KEY;
      expect(() => getModel('mistral', 'model'))
        .toThrow(/Set MISTRAL_API_KEY environment variable/);
    });

    // --- Cerebras (#2) ---
    it('should create a cerebras model when API key is set', () => {
      vi.stubEnv('CEREBRAS_API_KEY', 'test-key');
      const model = getModel('cerebras', 'llama-3.3-70b');
      expect(model).toBeDefined();
      expect((model as any).modelId).toBe('llama-3.3-70b');
    });

    it('should throw when CEREBRAS_API_KEY is missing', () => {
      delete process.env.CEREBRAS_API_KEY;
      expect(() => getModel('cerebras', 'model'))
        .toThrow(/Set CEREBRAS_API_KEY environment variable/);
    });

    // --- Together (#2) ---
    it('should create a together model when API key is set', () => {
      vi.stubEnv('TOGETHER_API_KEY', 'test-key');
      const model = getModel('together', 'meta-llama/Llama-3-70b');
      expect(model).toBeDefined();
      expect((model as any).modelId).toBe('meta-llama/Llama-3-70b');
    });

    it('should throw when TOGETHER_API_KEY is missing', () => {
      delete process.env.TOGETHER_API_KEY;
      expect(() => getModel('together', 'model'))
        .toThrow(/Set TOGETHER_API_KEY environment variable/);
    });

    // --- xAI (#2) ---
    it('should create a xai model when API key is set', () => {
      vi.stubEnv('XAI_API_KEY', 'test-key');
      const model = getModel('xai', 'grok-3');
      expect(model).toBeDefined();
      expect((model as any).modelId).toBe('grok-3');
    });

    it('should throw when XAI_API_KEY is missing', () => {
      delete process.env.XAI_API_KEY;
      expect(() => getModel('xai', 'model'))
        .toThrow(/Set XAI_API_KEY environment variable/);
    });

    // --- Fireworks ---
    it('should create a fireworks model when API key is set', () => {
      vi.stubEnv('FIREWORKS_API_KEY', 'test-key');
      const model = getModel('fireworks', 'qwen2.5-coder-32b');
      expect(model).toBeDefined();
      expect((model as any).modelId).toBe('qwen2.5-coder-32b');
    });

    it('should throw when FIREWORKS_API_KEY is missing', () => {
      delete process.env.FIREWORKS_API_KEY;
      expect(() => getModel('fireworks', 'model'))
        .toThrow(/Set FIREWORKS_API_KEY environment variable/);
    });

    // --- Cohere ---
    it('should create a cohere model when API key is set', () => {
      vi.stubEnv('COHERE_API_KEY', 'test-key');
      const model = getModel('cohere', 'command-r-plus');
      expect(model).toBeDefined();
      expect((model as any).modelId).toBe('command-r-plus');
    });

    it('should throw when COHERE_API_KEY is missing', () => {
      delete process.env.COHERE_API_KEY;
      expect(() => getModel('cohere', 'model'))
        .toThrow(/Set COHERE_API_KEY environment variable/);
    });

    // --- DeepInfra ---
    it('should create a deepinfra model when API key is set', () => {
      vi.stubEnv('DEEPINFRA_API_KEY', 'test-key');
      const model = getModel('deepinfra', 'deepseek-v3');
      expect(model).toBeDefined();
      expect((model as any).modelId).toBe('deepseek-v3');
    });

    it('should throw when DEEPINFRA_API_KEY is missing', () => {
      delete process.env.DEEPINFRA_API_KEY;
      expect(() => getModel('deepinfra', 'model'))
        .toThrow(/Set DEEPINFRA_API_KEY environment variable/);
    });

    // --- Moonshot ---
    it('should create a moonshot model when API key is set', () => {
      vi.stubEnv('MOONSHOT_API_KEY', 'test-key');
      const model = getModel('moonshot', 'kimi-k2-thinking');
      expect(model).toBeDefined();
      expect((model as any).modelId).toBe('kimi-k2-thinking');
    });

    it('should throw when MOONSHOT_API_KEY is missing', () => {
      delete process.env.MOONSHOT_API_KEY;
      expect(() => getModel('moonshot', 'model'))
        .toThrow(/Set MOONSHOT_API_KEY environment variable/);
    });

    // --- Perplexity ---
    it('should create a perplexity model when API key is set', () => {
      vi.stubEnv('PERPLEXITY_API_KEY', 'test-key');
      const model = getModel('perplexity', 'sonar-pro');
      expect(model).toBeDefined();
      expect((model as any).modelId).toBe('sonar-pro');
    });

    it('should throw when PERPLEXITY_API_KEY is missing', () => {
      delete process.env.PERPLEXITY_API_KEY;
      expect(() => getModel('perplexity', 'model'))
        .toThrow(/Set PERPLEXITY_API_KEY environment variable/);
    });

    // --- HuggingFace ---
    it('should create a huggingface model when API key is set', () => {
      vi.stubEnv('HUGGINGFACE_API_KEY', 'test-key');
      const model = getModel('huggingface', 'starcoder2-15b');
      expect(model).toBeDefined();
      expect((model as any).modelId).toBe('starcoder2-15b');
    });

    it('should throw when HUGGINGFACE_API_KEY is missing', () => {
      delete process.env.HUGGINGFACE_API_KEY;
      expect(() => getModel('huggingface', 'model'))
        .toThrow(/Set HUGGINGFACE_API_KEY environment variable/);
    });

    // --- Baseten ---
    it('should create a baseten model when API key is set', () => {
      vi.stubEnv('BASETEN_API_KEY', 'test-key');
      const model = getModel('baseten', 'custom-model');
      expect(model).toBeDefined();
      expect((model as any).modelId).toBe('custom-model');
    });

    it('should throw when BASETEN_API_KEY is missing', () => {
      delete process.env.BASETEN_API_KEY;
      expect(() => getModel('baseten', 'model'))
        .toThrow(/Set BASETEN_API_KEY environment variable/);
    });

    // --- SiliconFlow (OpenAI-compatible) ---
    it('should create a siliconflow model when API key is set', () => {
      vi.stubEnv('SILICONFLOW_API_KEY', 'test-key');
      const model = getModel('siliconflow', 'deepseek-v3');
      expect(model).toBeDefined();
      expect((model as any).modelId).toBe('deepseek-v3');
    });

    it('should throw when SILICONFLOW_API_KEY is missing', () => {
      delete process.env.SILICONFLOW_API_KEY;
      expect(() => getModel('siliconflow', 'model'))
        .toThrow(/Set SILICONFLOW_API_KEY environment variable/);
    });

    // --- Novita (OpenAI-compatible) ---
    it('should create a novita model when API key is set', () => {
      vi.stubEnv('NOVITA_API_KEY', 'test-key');
      const model = getModel('novita', 'llama-3-70b');
      expect(model).toBeDefined();
      expect((model as any).modelId).toBe('llama-3-70b');
    });

    it('should throw when NOVITA_API_KEY is missing', () => {
      delete process.env.NOVITA_API_KEY;
      expect(() => getModel('novita', 'model'))
        .toThrow(/Set NOVITA_API_KEY environment variable/);
    });
  });
});
