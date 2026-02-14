/**
 * LLM Provider types and interfaces
 */

export type Provider = 'anthropic' | 'openai' | 'google' | 'xai' | 'minimax' | 'kimi';

export interface LLMRequest {
  provider: Provider;
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface LLMResponse {
  success: boolean;
  response: string;
  error?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  latency?: number;
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface LLMAdapter {
  /**
   * Call LLM API directly
   * @param request - LLM request parameters
   * @returns LLM response with usage and latency
   */
  call(request: LLMRequest): Promise<LLMResponse>;
}
