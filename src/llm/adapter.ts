/**
 * LLM Adapter - Direct API calls to various LLM providers
 * Replaces OpenCode CLI subprocess execution
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import type { LLMAdapter, LLMRequest, LLMResponse, Provider, ProviderConfig } from './types.js';

const execFileAsync = promisify(execFile);

/**
 * Factory function to create appropriate LLM adapter
 */
export function createLLMAdapter(provider: Provider, config: ProviderConfig): LLMAdapter {
  switch (provider) {
    case 'anthropic':
      return new AnthropicAdapter(config);
    case 'openai':
      return new OpenAIAdapter(config);
    case 'google':
      return new GoogleAdapter(config);
    case 'xai':
      return new XAIAdapter(config);
    case 'minimax':
      return new MinimaxAdapter(config);
    case 'kimi':
      return new KimiAdapter(config);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Factory function for OpenCode backend
 * Uses OpenCode CLI instead of direct API calls
 */
export function createOpenCodeAdapter(config: ProviderConfig): LLMAdapter {
  return new OpenCodeAdapter(config);
}

/**
 * Base adapter with common HTTP logic
 */
abstract class BaseAdapter implements LLMAdapter {
  constructor(protected config: ProviderConfig) {}

  abstract call(request: LLMRequest): Promise<LLMResponse>;

  protected async fetchAPI(
    url: string,
    headers: Record<string, string>,
    body: unknown,
    timeout: number = 30000
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Anthropic (Claude) Adapter
 */
class AnthropicAdapter extends BaseAdapter {
  async call(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const url = this.config.baseUrl || 'https://api.anthropic.com/v1/messages';
      const headers = {
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      };

      const body: {
        model: string;
        max_tokens: number;
        temperature: number;
        messages: Array<{ role: string; content: string }>;
        system?: string;
      } = {
        model: request.model,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature ?? 0.7,
        messages: [
          {
            role: 'user',
            content: request.prompt,
          },
        ],
      };

      // Use native system parameter if provided
      if (request.systemPrompt) {
        body.system = request.systemPrompt;
      }

      const response = await this.fetchAPI(url, headers, body, request.timeout);

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          response: '',
          error: `Anthropic API error: ${response.status} ${error}`,
          latency: Date.now() - startTime,
        };
      }

      const data = await response.json();
      const content = data.content?.[0]?.text || '';

      return {
        success: true,
        response: content,
        usage: {
          inputTokens: data.usage?.input_tokens || 0,
          outputTokens: data.usage?.output_tokens || 0,
        },
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        response: '',
        error: error instanceof Error ? error.message : String(error),
        latency: Date.now() - startTime,
      };
    }
  }
}

/**
 * OpenAI (GPT) Adapter
 */
class OpenAIAdapter extends BaseAdapter {
  async call(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const url = this.config.baseUrl || 'https://api.openai.com/v1/chat/completions';
      const headers = {
        Authorization: `Bearer ${this.config.apiKey}`,
      };

      const messages: Array<{ role: string; content: string }> = [];
      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }
      messages.push({ role: 'user', content: request.prompt });

      const body = {
        model: request.model,
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens || 4096,
      };

      const response = await this.fetchAPI(url, headers, body, request.timeout);

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          response: '',
          error: `OpenAI API error: ${response.status} ${error}`,
          latency: Date.now() - startTime,
        };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      return {
        success: true,
        response: content,
        usage: {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
        },
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        response: '',
        error: error instanceof Error ? error.message : String(error),
        latency: Date.now() - startTime,
      };
    }
  }
}

/**
 * Google (Gemini) Adapter
 */
class GoogleAdapter extends BaseAdapter {
  async call(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const url =
        this.config.baseUrl ||
        `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${this.config.apiKey}`;

      const headers = {};

      const body: {
        contents: Array<{ parts: Array<{ text: string }> }>;
        generationConfig: { temperature: number; maxOutputTokens: number };
        systemInstruction?: { parts: Array<{ text: string }> };
      } = {
        contents: [
          {
            parts: [
              {
                text: request.prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens || 4096,
        },
      };

      // Use native systemInstruction if provided
      if (request.systemPrompt) {
        body.systemInstruction = {
          parts: [{ text: request.systemPrompt }],
        };
      }

      const response = await this.fetchAPI(url, headers, body, request.timeout);

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          response: '',
          error: `Google API error: ${response.status} ${error}`,
          latency: Date.now() - startTime,
        };
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      return {
        success: true,
        response: content,
        usage: {
          inputTokens: data.usageMetadata?.promptTokenCount || 0,
          outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
        },
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        response: '',
        error: error instanceof Error ? error.message : String(error),
        latency: Date.now() - startTime,
      };
    }
  }
}

/**
 * xAI (Grok) Adapter
 */
class XAIAdapter extends BaseAdapter {
  async call(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const url = this.config.baseUrl || 'https://api.x.ai/v1/chat/completions';
      const headers = {
        Authorization: `Bearer ${this.config.apiKey}`,
      };

      const messages: Array<{ role: string; content: string }> = [];
      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }
      messages.push({ role: 'user', content: request.prompt });

      const body = {
        model: request.model,
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens || 4096,
      };

      const response = await this.fetchAPI(url, headers, body, request.timeout);

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          response: '',
          error: `xAI API error: ${response.status} ${error}`,
          latency: Date.now() - startTime,
        };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      return {
        success: true,
        response: content,
        usage: {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
        },
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        response: '',
        error: error instanceof Error ? error.message : String(error),
        latency: Date.now() - startTime,
      };
    }
  }
}

/**
 * Minimax Adapter
 */
class MinimaxAdapter extends BaseAdapter {
  async call(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const url = this.config.baseUrl || 'https://api.minimax.chat/v1/text/chatcompletion_v2';
      const headers = {
        Authorization: `Bearer ${this.config.apiKey}`,
      };

      const messages: Array<{ role: string; content: string }> = [];
      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }
      messages.push({ role: 'user', content: request.prompt });

      const body = {
        model: request.model,
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens || 4096,
      };

      const response = await this.fetchAPI(url, headers, body, request.timeout);

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          response: '',
          error: `Minimax API error: ${response.status} ${error}`,
          latency: Date.now() - startTime,
        };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      return {
        success: true,
        response: content,
        usage: {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
        },
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        response: '',
        error: error instanceof Error ? error.message : String(error),
        latency: Date.now() - startTime,
      };
    }
  }
}

/**
 * Kimi (Moonshot) Adapter
 */
class KimiAdapter extends BaseAdapter {
  async call(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const url = this.config.baseUrl || 'https://api.moonshot.cn/v1/chat/completions';
      const headers = {
        Authorization: `Bearer ${this.config.apiKey}`,
      };

      const messages: Array<{ role: string; content: string }> = [];
      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }
      messages.push({ role: 'user', content: request.prompt });

      const body = {
        model: request.model,
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens || 4096,
      };

      const response = await this.fetchAPI(url, headers, body, request.timeout);

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          response: '',
          error: `Kimi API error: ${response.status} ${error}`,
          latency: Date.now() - startTime,
        };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      return {
        success: true,
        response: content,
        usage: {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
        },
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        response: '',
        error: error instanceof Error ? error.message : String(error),
        latency: Date.now() - startTime,
      };
    }
  }
}

/**
 * OpenCode CLI Adapter
 * Uses OpenCode CLI as a backend (for GitHub Copilot, Codex, OpenRouter, etc.)
 */
class OpenCodeAdapter implements LLMAdapter {
  constructor(protected config: ProviderConfig) {}

  async call(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const args = [request.provider, request.model];

      // Build prompt (system + user)
      let fullPrompt = '';
      if (request.systemPrompt) {
        fullPrompt += `${request.systemPrompt}\n\n`;
      }
      fullPrompt += request.prompt;

      // Add optional parameters
      if (request.temperature !== undefined) {
        args.push('--temperature', String(request.temperature));
      }
      if (request.maxTokens) {
        args.push('--max-tokens', String(request.maxTokens));
      }

      // Execute opencode CLI
      const { stdout } = await execFileAsync('opencode', args, {
        input: fullPrompt,
        timeout: request.timeout || 30000,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });

      return {
        success: true,
        response: stdout.trim(),
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        response: '',
        error: error instanceof Error ? error.message : String(error),
        latency: Date.now() - startTime,
      };
    }
  }
}
