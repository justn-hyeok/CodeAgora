import type { ExecutionResult } from './types.js';
import type { ParsedReview, ParseResult } from '../parser/schema.js';
import { transformReviewerResponse } from '../parser/transformer.js';

export function collectReviews(
  file: string,
  executionResult: ExecutionResult
): ParseResult[] {
  const results: ParseResult[] = [];

  for (const execution of executionResult.executions) {
    if (execution.status === 'success' && execution.response) {
      const parseResult = transformReviewerResponse(
        execution.reviewer,
        file,
        execution.response
      );
      results.push(parseResult);
    } else {
      // Failed executions are not included in parsed reviews
      // They will be logged/reported separately
    }
  }

  return results;
}

export function getSuccessfulReviews(results: ParseResult[]): ParsedReview[] {
  return results
    .filter((r) => r.success)
    .map((r) => (r as { success: true; review: ParsedReview }).review);
}

export function getFailedReviews(results: ParseResult[]): string[] {
  return results
    .filter((r) => !r.success)
    .map((r) => (r as { success: false; error: string }).error);
}
