import { writeFile, readFile, unlink, mkdtemp, rmdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import crypto from 'crypto';
import type { Reviewer } from '../config/schema.js';
import type { ReviewRequest } from './types.js';
import { createLLMAdapter, createOpenCodeAdapter } from '../llm/adapter.js';
import { getProviderConfig } from '../llm/config.js';
import type { Provider } from '../llm/types.js';

/**
 * Result type for reviewer backend execution
 */
export type ReviewerBackendResult =
  | { success: true; response: string }
  | { success: false; error: string };

/**
 * Interface for reviewer backends
 */
export interface ReviewerBackend {
  /**
   * Execute a code review using the specified reviewer configuration
   */
  execute(reviewer: Reviewer, request: ReviewRequest): Promise<ReviewerBackendResult>;
}

/**
 * Mock backend for testing - returns a simple mock review
 */
export class MockBackend implements ReviewerBackend {
  async execute(reviewer: Reviewer, _request: ReviewRequest): Promise<ReviewerBackendResult> {
    // Create secure temp directory
    const tmpDir = await mkdtemp(join(tmpdir(), 'omc-review-'));
    const outputFile = join(tmpDir, `review_${crypto.randomUUID()}.json`);

    try {
      // Mock response - simulates what a real reviewer would return
      const mockResponse = `[MINOR] style | 1 | Mock review issue
This is a mock review from ${reviewer.name}
suggestion: Fix this
confidence: 0.8`;

      await writeFile(outputFile, mockResponse, { encoding: 'utf-8', mode: 0o600 });

      // Read response
      const response = await readFile(outputFile, 'utf-8');

      // Cleanup
      try {
        await unlink(outputFile);
        await rmdir(tmpDir);
      } catch {
        // Ignore cleanup errors
      }

      return {
        success: true,
        response,
      };
    } catch (error) {
      // Cleanup on error
      try {
        await unlink(outputFile);
        await rmdir(tmpDir);
      } catch {
        // Ignore cleanup errors
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * OpenCode backend - executes reviews using LLM API calls
 * Supports both direct API calls and OpenCode CLI backend
 */
export class OpenCodeBackend implements ReviewerBackend {
  constructor(private backendType: 'direct' | 'opencode' = 'direct') {}

  async execute(reviewer: Reviewer, request: ReviewRequest): Promise<ReviewerBackendResult> {
    try {
      // Get provider configuration (API keys from env)
      const providerConfig = getProviderConfig(reviewer.provider as Provider);

      // Create appropriate adapter based on backend type
      const adapter =
        this.backendType === 'opencode'
          ? createOpenCodeAdapter(providerConfig)
          : createLLMAdapter(reviewer.provider as Provider, providerConfig);

      // Call LLM API (direct or via OpenCode CLI)
      const result = await adapter.call({
        provider: reviewer.provider as Provider,
        model: reviewer.model,
        prompt: request.userPrompt,
        systemPrompt: request.systemPrompt,
        timeout: reviewer.timeout * 1000, // Convert seconds to milliseconds
      });

      // Return the response
      if (result.success) {
        return {
          success: true,
          response: result.response,
        };
      } else {
        return {
          success: false,
          error: result.error || 'Unknown error',
        };
      }
    } catch (error) {
      // Handle configuration errors (missing API keys, etc.)
      if (error instanceof Error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: false,
        error: String(error),
      };
    }
  }
}

/**
 * Factory function to create the appropriate backend
 */
export function createBackend(
  type: 'mock' | 'opencode' = 'mock',
  backendType: 'direct' | 'opencode' = 'direct'
): ReviewerBackend {
  switch (type) {
    case 'mock':
      return new MockBackend();
    case 'opencode':
      return new OpenCodeBackend(backendType);
    default:
      return new MockBackend();
  }
}
