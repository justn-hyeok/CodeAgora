/**
 * Diff Utilities - Code Snippet Extraction
 */

export interface CodeSnippet {
  filePath: string;
  lineRange: [number, number];
  code: string;
  context: string; // Full context with line numbers
}

/**
 * Extract code snippet from diff with ±N lines context
 */
export function extractCodeSnippet(
  diffContent: string,
  filePath: string,
  lineRange: [number, number],
  contextLines: number = 10
): CodeSnippet | null {
  // Parse diff to find the file section
  const fileSection = extractFileSection(diffContent, filePath);
  if (!fileSection) {
    return null;
  }

  // Extract lines around the target range
  const lines = fileSection.split('\n');
  const snippetLines: string[] = [];
  let currentLine = 0;
  let foundStart = false;

  for (const line of lines) {
    // Track line numbers from diff hunks
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -\d+,?\d* \+(\d+),?\d* @@/);
      if (match) {
        currentLine = parseInt(match[1], 10) - 1;
      }
      continue;
    }

    // Skip removed lines
    if (line.startsWith('-')) {
      continue;
    }

    // Count added/context lines
    if (line.startsWith('+') || line.startsWith(' ')) {
      currentLine++;
    }

    // Check if we're in the target range ± context
    const [startLine, endLine] = lineRange;
    const inRange =
      currentLine >= startLine - contextLines &&
      currentLine <= endLine + contextLines;

    if (inRange) {
      foundStart = true;
      const lineNumber = String(currentLine).padStart(4, ' ');
      const content = line.substring(1); // Remove diff prefix (+/- / )
      snippetLines.push(`${lineNumber} | ${content}`);
    } else if (foundStart) {
      // We've passed the range, stop
      break;
    }
  }

  if (snippetLines.length === 0) {
    return null;
  }

  return {
    filePath,
    lineRange,
    code: snippetLines.join('\n'),
    context: `File: ${filePath} (lines ${lineRange[0]}-${lineRange[1]})`,
  };
}

/**
 * Extract file section from full diff
 */
function extractFileSection(diffContent: string, filePath: string): string | null {
  const sections = diffContent.split(/(?=diff --git)/);

  for (const section of sections) {
    if (section.includes(`b/${filePath}`)) {
      return section;
    }
  }

  return null;
}

/**
 * Batch extract snippets for multiple issues
 */
export function extractMultipleSnippets(
  diffContent: string,
  issues: Array<{ filePath: string; lineRange: [number, number] }>,
  contextLines: number = 10
): Map<string, CodeSnippet> {
  const snippets = new Map<string, CodeSnippet>();

  for (const issue of issues) {
    const key = `${issue.filePath}:${issue.lineRange[0]}-${issue.lineRange[1]}`;
    const snippet = extractCodeSnippet(
      diffContent,
      issue.filePath,
      issue.lineRange,
      contextLines
    );

    if (snippet) {
      snippets.set(key, snippet);
    }
  }

  return snippets;
}
