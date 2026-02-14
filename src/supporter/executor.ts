import type { Supporter } from '../config/schema.js';
import type { ParsedReview } from '../parser/schema.js';
import type { SupporterExecutionResult, SupporterValidationRequest } from './types.js';
import { CodexSupporter } from './codex.js';
import { GeminiSupporter } from './gemini.js';

export async function executeSupporters(
  supporters: { codex?: Supporter; gemini?: Supporter },
  reviews: ParsedReview[],
  fileContents: Map<string, string>
): Promise<SupporterExecutionResult[]> {
  const results: SupporterExecutionResult[] = [];

  // Build validation requests from all issues
  const requests: SupporterValidationRequest[] = [];

  for (const review of reviews) {
    for (const issue of review.issues) {
      const context = fileContents.get(review.file) || '';
      requests.push({
        issue,
        file: review.file,
        context,
      });
    }
  }

  // Execute enabled supporters in parallel
  const executions: Promise<SupporterExecutionResult>[] = [];

  if (supporters.codex?.enabled) {
    executions.push(executeSupporter(new CodexSupporter(), requests));
  }

  if (supporters.gemini?.enabled) {
    executions.push(executeSupporter(new GeminiSupporter(), requests));
  }

  const settled = await Promise.allSettled(executions);

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      results.push(result.value);
    } else {
      console.error(`Supporter execution failed: ${result.reason}`);
    }
  }

  return results;
}

async function executeSupporter(
  supporter: CodexSupporter | GeminiSupporter,
  requests: SupporterValidationRequest[]
): Promise<SupporterExecutionResult> {
  const startTime = Date.now();

  try {
    const results = await Promise.all(
      requests.map((req) => supporter.validate(req))
    );

    return {
      supporter: supporter.name,
      results,
      duration: Date.now() - startTime,
      success: true,
    };
  } catch (error) {
    return {
      supporter: supporter.name,
      results: [],
      duration: Date.now() - startTime,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
