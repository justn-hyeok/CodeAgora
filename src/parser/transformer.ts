import { parseReviewerResponse } from './regex-parser.js';
import type { ParsedReview, ParseResult } from './schema.js';

export function transformReviewerResponse(
  reviewer: string,
  file: string,
  response: string
): ParseResult {
  try {
    const blocks = parseReviewerResponse(response);

    const issues = blocks
      .filter((block) => block.issue !== null)
      .map((block) => block.issue!);

    const parseFailures = blocks
      .filter((block) => block.issue === null)
      .map((block) => ({
        raw: block.raw,
        reason: block.parseError || 'Unknown parsing error',
      }));

    const review: ParsedReview = {
      reviewer,
      file,
      issues,
      parseFailures,
    };

    return {
      success: true,
      review,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to transform response: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
