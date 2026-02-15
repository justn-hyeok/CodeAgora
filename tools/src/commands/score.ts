/**
 * score command
 * Trajectory Scoring - 5 regex patterns for argument quality
 */

import type { ScoreOutput } from '../types/index.js';
import { ScoreInputSchema } from '../types/index.js';

export function scoreReasoning(reasoning: string): ScoreOutput {
  let score = 0.5; // Base score

  // Pattern 1: Code reference (+0.1)
  const codeReference = /line\s+\d+|function\s+\w+|variable\s+\w+|method\s+\w+/i.test(
    reasoning
  );
  if (codeReference) score += 0.1;

  // Pattern 2: Technical depth (+0.1)
  const technicalDepth =
    /memory|performance|security|thread|race\s+condition|deadlock|leak/i.test(reasoning);
  if (technicalDepth) score += 0.1;

  // Pattern 3: Evidence-based (+0.1)
  const evidenceBased = /because|since|given\s+that|due\s+to|as\s+a\s+result/i.test(
    reasoning
  );
  if (evidenceBased) score += 0.1;

  // Pattern 4: Specific examples (+0.1)
  const specificExamples =
    /specifically|exactly|for\s+example|such\s+as|this\s+will\s+cause/i.test(reasoning);
  if (specificExamples) score += 0.1;

  // Pattern 5: Code snippets (+0.1)
  const codeSnippets = /`[^`]+`|```/.test(reasoning);
  if (codeSnippets) score += 0.1;

  return {
    score: Math.min(score, 1.0),
    breakdown: {
      codeReference,
      technicalDepth,
      evidenceBased,
      specificExamples,
      codeSnippets,
    },
  };
}

export function score(inputJson: string): string {
  try {
    const input = JSON.parse(inputJson) as unknown;
    const validated = ScoreInputSchema.parse(input);

    const output = scoreReasoning(validated.reasoning);

    return JSON.stringify(output, null, 2);
  } catch (error) {
    return JSON.stringify(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    );
  }
}
