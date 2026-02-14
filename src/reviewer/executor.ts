import type { Reviewer } from '../config/schema.js';
import type { ReviewRequest, ReviewerExecution, ExecutionResult } from './types.js';
import type { ReviewerBackend } from './adapter.js';
import { createBackend } from './adapter.js';

async function executeReviewer(
  reviewer: Reviewer,
  request: ReviewRequest,
  backend: ReviewerBackend = createBackend('mock')
): Promise<ReviewerExecution> {
  const startTime = Date.now();

  try {
    const result = await backend.execute(reviewer, request);

    if (result.success) {
      return {
        reviewer: reviewer.name,
        status: 'success',
        response: result.response,
        duration: Date.now() - startTime,
      };
    } else {
      return {
        reviewer: reviewer.name,
        status: 'failed',
        error: result.error,
        duration: Date.now() - startTime,
      };
    }
  } catch (error) {
    // Check for timeout by examining the error object safely
    const isTimeout = error instanceof Error && 'killed' in error && (error as { killed?: boolean }).killed;

    if (isTimeout) {
      return {
        reviewer: reviewer.name,
        status: 'timeout',
        error: `Timeout after ${reviewer.timeout}s`,
        duration: Date.now() - startTime,
      };
    }

    return {
      reviewer: reviewer.name,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  }
}

export async function executeReviewers(
  reviewers: Reviewer[],
  request: ReviewRequest,
  maxParallel: number = 5,
  backend?: ReviewerBackend
): Promise<ExecutionResult> {
  const enabledReviewers = reviewers.filter((r) => r.enabled);

  if (enabledReviewers.length === 0) {
    return {
      executions: [],
      successful: 0,
      failed: 0,
    };
  }

  // Execute reviewers in batches
  const executions: ReviewerExecution[] = [];
  const batches: Reviewer[][] = [];

  for (let i = 0; i < enabledReviewers.length; i += maxParallel) {
    batches.push(enabledReviewers.slice(i, i + maxParallel));
  }

  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map((reviewer) => executeReviewer(reviewer, request, backend))
    );
    executions.push(...batchResults);
  }

  const successful = executions.filter((e) => e.status === 'success').length;
  const failed = executions.length - successful;

  return {
    executions,
    successful,
    failed,
  };
}
