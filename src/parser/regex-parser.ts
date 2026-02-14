import type { ReviewIssue, Severity } from './schema.js';
import { ReviewIssueSchema } from './schema.js';

const CONFIDENCE_REGEX = /confidence:\s*(-?\d+\.?\d*)/i;
const SUGGESTION_REGEX = /suggestion:\s*(.+?)(?=\n(?:confidence:|$)|$)/is;

function normalizeSeverity(severity: string): Severity {
  const normalized = severity.toUpperCase();

  switch (normalized) {
    case 'CRITICAL':
      return 'CRITICAL';
    case 'MAJOR':
      return 'MAJOR';
    case 'MINOR':
      return 'MINOR';
    case 'SUGGESTION':
      return 'SUGGESTION';
    default:
      // Fallback to MINOR for unrecognized severity
      return 'MINOR';
  }
}

function extractConfidence(text: string): number {
  const match = text.match(CONFIDENCE_REGEX);

  if (!match) {
    return 0.5; // Default confidence
  }

  const confidence = parseFloat(match[1]);

  // Clamp between 0 and 1
  return Math.max(0, Math.min(1, confidence));
}

function extractSuggestion(text: string): string | undefined {
  const match = text.match(SUGGESTION_REGEX);
  return match ? match[1].trim() : undefined;
}

function extractDescription(fullText: string, headerLength: number): string | undefined {
  // Extract everything after the header until suggestion/confidence
  let description = fullText.substring(headerLength).trim();

  // Remove suggestion and confidence from description
  description = description.replace(SUGGESTION_REGEX, '').trim();
  description = description.replace(CONFIDENCE_REGEX, '').trim();

  return description || undefined;
}

export interface ParsedIssueBlock {
  issue: ReviewIssue | null;
  raw: string;
  parseError?: string;
}

export function parseIssueBlock(blockText: string): ParsedIssueBlock {
  // Create new regex each time to avoid stateful issues
  const headerRegex = /\[([a-zA-Z]+)\]\s*(.+?)\s*\|\s*L?(\d+)(?:-L?(\d+))?\s*\|\s*(.+)/i;
  const match = blockText.match(headerRegex);

  if (!match) {
    return {
      issue: null,
      raw: blockText,
      parseError: 'Could not match issue header pattern',
    };
  }

  const [fullMatch, severityRaw, category, lineStart, lineEnd, title] = match;

  try {
    const severity = normalizeSeverity(severityRaw);
    const line = parseInt(lineStart, 10);
    const lineEndNum = lineEnd ? parseInt(lineEnd, 10) : undefined;

    const description = extractDescription(blockText, fullMatch.length);
    const suggestion = extractSuggestion(blockText);
    const confidence = extractConfidence(blockText);

    const issueData = {
      severity,
      category: category.trim(),
      line,
      lineEnd: lineEndNum,
      title: title.trim(),
      description,
      suggestion,
      confidence,
    };

    // Validate with zod schema
    const validationResult = ReviewIssueSchema.safeParse(issueData);

    if (!validationResult.success) {
      return {
        issue: null,
        raw: blockText,
        parseError: `Schema validation failed: ${validationResult.error.message}`,
      };
    }

    return {
      issue: validationResult.data,
      raw: blockText,
    };
  } catch (error) {
    return {
      issue: null,
      raw: blockText,
      parseError: error instanceof Error ? error.message : String(error),
    };
  }
}

export function parseReviewerResponse(response: string): ParsedIssueBlock[] {
  if (!response || !response.trim()) {
    return [];
  }

  // Check for "no issues" response
  const lowerResponse = response.toLowerCase();
  if (
    lowerResponse.includes('no issues found') ||
    lowerResponse.includes('no problems found')
  ) {
    return [];
  }

  const blocks: ParsedIssueBlock[] = [];

  // Find all issue block headers
  const headerRegex = /\[([a-zA-Z]+)\]\s*(.+?)\s*\|\s*L?(\d+)(?:-L?(\d+))?\s*\|\s*(.+)/gim;
  const matches = Array.from(response.matchAll(headerRegex));

  if (matches.length === 0) {
    // No structured issues found, treat entire response as parse failure
    blocks.push({
      issue: null,
      raw: response,
      parseError: 'No structured issue blocks found in response',
    });
    return blocks;
  }

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const startIndex = match.index!;
    const nextMatch = matches[i + 1];
    const endIndex = nextMatch ? nextMatch.index! : response.length;

    const blockText = response.substring(startIndex, endIndex).trim();
    blocks.push(parseIssueBlock(blockText));
  }

  return blocks;
}
