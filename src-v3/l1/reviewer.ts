/**
 * L1 Reviewer - Evidence Document Writer
 * Executes 5 reviewers in parallel, each writes evidence documents
 */

import type { ReviewerConfig } from '../types/config.js';
import type { ReviewOutput, EvidenceDocument } from '../types/core.js';
import { parseEvidenceResponse } from './parser.js';
import { executeBackend } from './backend.js';

// ============================================================================
// Reviewer Execution
// ============================================================================

export interface ReviewerInput {
  config: ReviewerConfig;
  groupName: string;
  diffContent: string;
  prSummary: string;
}

/**
 * Execute a single reviewer
 */
export async function executeReviewer(
  input: ReviewerInput,
  retries: number = 2
): Promise<ReviewOutput> {
  const { config, groupName, diffContent, prSummary } = input;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await executeBackend({
        backend: config.backend,
        model: config.model,
        provider: config.provider,
        prompt: buildReviewerPrompt(diffContent, prSummary),
        timeout: config.timeout,
      });

      // Parse response into evidence documents
      const evidenceDocs = parseEvidenceResponse(response);

      return {
        reviewerId: config.id,
        model: config.model,
        group: groupName,
        evidenceDocs,
        rawResponse: response,
        status: 'success',
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < retries) {
        // Wait before retry (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  // All retries failed
  return {
    reviewerId: config.id,
    model: config.model,
    group: groupName,
    evidenceDocs: [],
    rawResponse: '',
    status: 'forfeit',
    error: lastError?.message || 'Unknown error',
  };
}

/**
 * Execute multiple reviewers in parallel
 */
export async function executeReviewers(
  inputs: ReviewerInput[],
  maxRetries: number = 2
): Promise<ReviewOutput[]> {
  const results = await Promise.all(
    inputs.map((input) => executeReviewer(input, maxRetries))
  );

  return results;
}

/**
 * Check forfeit threshold
 */
export function checkForfeitThreshold(
  results: ReviewOutput[],
  threshold: number = 0.7
): { passed: boolean; forfeitRate: number } {
  const totalReviewers = results.length;
  const forfeitCount = results.filter((r) => r.status === 'forfeit').length;
  const forfeitRate = forfeitCount / totalReviewers;

  return {
    passed: forfeitRate < threshold,
    forfeitRate,
  };
}

// ============================================================================
// Prompt Building
// ============================================================================

function buildReviewerPrompt(diffContent: string, prSummary: string): string {
  return `# Code Review Task

## PR Summary
${prSummary}

## Your Task
Review the following code changes and identify any issues. For each issue you find, write an evidence document in the following format:

\`\`\`markdown
## Issue: [Clear, concise title]

### 문제
[What is the problem?]

### 근거
1. [Specific evidence 1]
2. [Specific evidence 2]
3. [Specific evidence 3]

### 심각도
[HARSHLY_CRITICAL / CRITICAL / WARNING / SUGGESTION]

### 제안
[How to fix it?]
\`\`\`

**Important:**
- HARSHLY_CRITICAL: Security vulnerabilities, data loss risks, critical bugs that will cause immediate failure
- CRITICAL: Major bugs, serious performance issues, incorrect logic
- WARNING: Code quality issues, potential bugs, maintainability concerns
- SUGGESTION: Style improvements, minor optimizations, best practice recommendations

## Code Changes

\`\`\`diff
${diffContent}
\`\`\`

---

Write your evidence documents below. If you find no issues, write "No issues found."
`;
}
