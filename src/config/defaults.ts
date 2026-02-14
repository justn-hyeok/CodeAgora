import type { Config } from './schema.js';

export const DEFAULT_CONFIG: Config = {
  head_agent: {
    provider: 'anthropic',
    model: 'claude-opus-4.6',
    fallback_model: 'claude-sonnet-4.5',
  },
  supporters: {
    codex: {
      provider: 'openai',
      model: 'gpt-5.1-codex-mini',
      enabled: true,
    },
    gemini: {
      provider: 'google',
      model: 'gemini-2.5-flash',
      enabled: true,
    },
  },
  discord: {
    enabled: false,
  },
  reviewers: [
    {
      name: 'minimax-free',
      provider: 'minimax',
      model: 'minimax-m2.5-free',
      enabled: true,
      timeout: 300,
    },
    {
      name: 'grok-fast',
      provider: 'xai',
      model: 'grok-code-fast-1',
      enabled: true,
      timeout: 300,
    },
    {
      name: 'kimi-free',
      provider: 'kimi',
      model: 'kimi-k2.5-free',
      enabled: true,
      timeout: 300,
    },
    {
      name: 'gemini-flash',
      provider: 'google',
      model: 'gemini-3-flash-preview',
      enabled: true,
      timeout: 300,
    },
    {
      name: 'claude-haiku',
      provider: 'anthropic',
      model: 'claude-haiku-4.5',
      enabled: false,
      timeout: 300,
    },
    {
      name: 'gpt-codex-mini',
      provider: 'openai',
      model: 'gpt-5.1-codex-mini',
      enabled: false,
      timeout: 300,
    },
  ],
  settings: {
    min_reviewers: 3,
    max_parallel: 5,
    output_format: 'markdown',
    default_timeout: 300,
  },
};

export function generateDefaultConfig(): string {
  return JSON.stringify(DEFAULT_CONFIG, null, 2);
}
