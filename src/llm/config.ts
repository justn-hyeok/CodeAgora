/**
 * LLM Provider configuration loader
 * Loads API keys from environment variables or config file
 */

import type { Provider, ProviderConfig } from './types.js';

/**
 * Get provider configuration from environment variables
 */
export function getProviderConfig(provider: Provider): ProviderConfig {
  const apiKey = getAPIKey(provider);

  if (!apiKey) {
    throw new Error(
      `API key not found for provider: ${provider}. ` +
        `Set environment variable: ${getEnvVarName(provider)}`
    );
  }

  return {
    apiKey,
    baseUrl: getBaseURL(provider),
  };
}

/**
 * Get API key from environment variables
 */
function getAPIKey(provider: Provider): string {
  const envVar = getEnvVarName(provider);
  return process.env[envVar] || '';
}

/**
 * Get environment variable name for provider
 */
export function getEnvVarName(provider: Provider): string {
  switch (provider) {
    case 'anthropic':
      return 'ANTHROPIC_API_KEY';
    case 'openai':
      return 'OPENAI_API_KEY';
    case 'google':
      return 'GOOGLE_API_KEY';
    case 'xai':
      return 'XAI_API_KEY';
    case 'minimax':
      return 'MINIMAX_API_KEY';
    case 'kimi':
      return 'KIMI_API_KEY';
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Get custom base URL from environment if set
 */
function getBaseURL(provider: Provider): string | undefined {
  const envVar = `${getEnvVarName(provider).replace('_API_KEY', '_BASE_URL')}`;
  return process.env[envVar];
}

/**
 * Check if provider has valid API key configured
 */
export function hasProviderConfig(provider: Provider): boolean {
  return !!getAPIKey(provider);
}

/**
 * List all configured providers
 */
export function getConfiguredProviders(): Provider[] {
  const allProviders: Provider[] = ['anthropic', 'openai', 'google', 'xai', 'minimax', 'kimi'];
  return allProviders.filter((p) => hasProviderConfig(p));
}
