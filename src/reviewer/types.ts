import type { DiffChunk } from '../diff/types.js';

export interface ReviewerExecution {
  reviewer: string;
  status: 'success' | 'failed' | 'timeout';
  response?: string;
  error?: string;
  duration: number;
}

export interface ExecutionResult {
  executions: ReviewerExecution[];
  successful: number;
  failed: number;
}

export interface ReviewRequest {
  chunk: DiffChunk;
  systemPrompt: string;
  userPrompt: string;
}
