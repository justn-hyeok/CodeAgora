import type { ReviewIssue } from '../parser/schema.js';

export interface SupporterValidationRequest {
  issue: ReviewIssue;
  file: string;
  context: string; // Full file content or relevant code block
}

export interface SupporterValidationResult {
  issue: ReviewIssue;
  validated: boolean;
  evidence: string;
  toolOutput?: string; // Lint/typecheck output
  confidence: number;
}

export interface SupporterBackend {
  name: string;
  validate(request: SupporterValidationRequest): Promise<SupporterValidationResult>;
}

export interface SupporterExecutionResult {
  supporter: string;
  results: SupporterValidationResult[];
  duration: number;
  success: boolean;
  error?: string;
}
