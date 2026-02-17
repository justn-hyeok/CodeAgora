/**
 * L1 Parser - Evidence Document Parser
 * Parses reviewer responses into structured evidence documents
 */

import type { EvidenceDocument, Severity } from '../types/core.js';

// ============================================================================
// Evidence Document Parser
// ============================================================================

const EVIDENCE_BLOCK_REGEX = /## Issue:\s*(.+?)\n[\s\S]*?### 문제\n([\s\S]*?)### 근거\n([\s\S]*?)### 심각도\n([\s\S]*?)### 제안\n([\s\S]*?)(?=\n## Issue:|$)/gi;

/**
 * Parse reviewer response into evidence documents
 */
export function parseEvidenceResponse(response: string): EvidenceDocument[] {
  // Check for "no issues" response
  const lowerResponse = response.toLowerCase();
  if (
    lowerResponse.includes('no issues found') ||
    lowerResponse.includes('no problems found') ||
    lowerResponse.includes('looks good')
  ) {
    return [];
  }

  const documents: EvidenceDocument[] = [];
  const matches = Array.from(response.matchAll(EVIDENCE_BLOCK_REGEX));

  for (const match of matches) {
    try {
      const [_, title, problem, evidenceText, severityText, suggestion] = match;

      const evidence = evidenceText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.match(/^\d+\./))
        .map((line) => line.replace(/^\d+\.\s*/, ''));

      const severity = parseSeverity(severityText.trim());
      const fileInfo = extractFileInfo(problem);

      documents.push({
        issueTitle: title.trim(),
        problem: problem.trim(),
        evidence,
        severity,
        suggestion: suggestion.trim(),
        filePath: fileInfo.filePath,
        lineRange: fileInfo.lineRange,
      });
    } catch (error) {
      // Skip malformed evidence blocks
      continue;
    }
  }

  return documents;
}

// ============================================================================
// Helpers
// ============================================================================

function parseSeverity(severityText: string): Severity {
  const normalized = severityText.toUpperCase().trim();

  if (normalized.includes('HARSHLY_CRITICAL') || normalized.includes('HARSHLY CRITICAL')) {
    return 'HARSHLY_CRITICAL';
  }
  if (normalized.includes('CRITICAL')) {
    return 'CRITICAL';
  }
  if (normalized.includes('WARNING')) {
    return 'WARNING';
  }
  return 'SUGGESTION';
}

function extractFileInfo(problemText: string): {
  filePath: string;
  lineRange: [number, number];
} {
  // Try to extract file path and line numbers from problem text
  // Format: "In file.ts:123-456" or "file.ts line 123"
  const fileMatch = problemText.match(/(?:In\s+)?([a-zA-Z0-9_/.-]+\.[a-z]+)(?::|\s+line\s+)(\d+)(?:-(\d+))?/i);

  if (fileMatch) {
    const filePath = fileMatch[1];
    const lineStart = parseInt(fileMatch[2], 10);
    const lineEnd = fileMatch[3] ? parseInt(fileMatch[3], 10) : lineStart;

    return {
      filePath,
      lineRange: [lineStart, lineEnd],
    };
  }

  // Fallback
  return {
    filePath: 'unknown',
    lineRange: [0, 0],
  };
}
