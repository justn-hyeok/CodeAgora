/**
 * parse-reviews command
 * Parses raw reviewer responses into structured ParsedReview objects
 */

import type { ParseReviewsOutput } from '../types/index.js';
import { ParseReviewsInputSchema } from '../types/index.js';
import { transformReviewerResponse } from '../utils/parser.js';

/**
 * Extract content from Gemini CLI JSON wrapper format
 * Gemini CLI wraps responses in { "session_id": "...", "response": "...", "stats": {...} }
 * This function detects and extracts the actual review content
 */
function extractGeminiContent(response: string): string {
  try {
    const parsed = JSON.parse(response);

    // Gemini CLI format: { response: "...", session_id: "...", stats: {...} }
    if (parsed.response && typeof parsed.response === 'string') {
      return parsed.response;
    }

    // Fallback: return original if not Gemini format
  } catch {
    // Not valid JSON, return original
  }

  return response;
}

export function parseReviews(inputJson: string): string {
  try {
    const input = JSON.parse(inputJson) as unknown;
    const validated = ParseReviewsInputSchema.parse(input);

    const parsedReviews = validated.reviews.map((review) => {
      // Extract content from Gemini JSON wrapper if present
      const cleanedResponse = extractGeminiContent(review.response);
      return transformReviewerResponse(review.reviewer, review.file, cleanedResponse);
    });

    const output: ParseReviewsOutput = { parsedReviews };

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
