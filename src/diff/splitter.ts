import type { DiffChunk } from './types.js';
import { extname } from 'path';

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.rb': 'ruby',
  '.php': 'php',
  '.cs': 'csharp',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.sh': 'bash',
  '.md': 'markdown',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.xml': 'xml',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sql': 'sql',
};

function getLanguage(filePath: string): string {
  const ext = extname(filePath);
  return LANGUAGE_MAP[ext] || 'unknown';
}

/**
 * Validate file path to prevent path traversal and other attacks
 * Returns true if the path is safe to use
 */
function isValidFilePath(filePath: string): boolean {
  // Reject null bytes
  if (filePath.includes('\0')) {
    return false;
  }

  // Reject absolute paths (Unix)
  if (filePath.startsWith('/')) {
    return false;
  }

  // Reject absolute paths (Windows - drive letters)
  if (/^[A-Za-z]:[\\/]/.test(filePath)) {
    return false;
  }

  // Reject home directory expansion
  if (filePath.startsWith('~')) {
    return false;
  }

  // Reject path traversal patterns (including bare .. at end)
  if (/\.\.(?:[\\/]|$)/.test(filePath)) {
    return false;
  }

  // Reject encoded traversal attempts
  if (filePath.toLowerCase().includes('%2e%2e')) {
    return false;
  }

  return true;
}

export function splitDiffByFile(diffContent: string): DiffChunk[] {
  const chunks: DiffChunk[] = [];

  // Split by "diff --git" marker
  const fileDiffs = diffContent.split(/(?=diff --git)/);

  for (const fileDiff of fileDiffs) {
    if (!fileDiff.trim()) continue;

    // Extract file path from "diff --git a/path b/path"
    const fileMatch = fileDiff.match(/diff --git a\/(.+?) b\/(.+)/);
    if (!fileMatch) continue;

    const filePath = fileMatch[2];

    // Validate file path for security
    if (!isValidFilePath(filePath)) {
      // Sanitize path for logging (strip non-printable characters to prevent terminal injection)
      const sanitized = filePath.replace(/[^\x20-\x7E]/g, '');
      console.warn(`Skipping invalid file path: ${sanitized}`);
      continue;
    }

    // Skip deleted files
    if (fileDiff.includes('deleted file mode')) {
      continue;
    }

    // Get language
    const language = getLanguage(filePath);

    // Split file diff into hunks (each starting with @@)
    const hunkMatches = fileDiff.matchAll(/@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@.*$/gm);
    const hunkStarts: number[] = [];
    const hunkRanges: [number, number][] = [];

    // Collect all hunk positions and their line ranges
    for (const match of hunkMatches) {
      hunkStarts.push(match.index!);
      const start = parseInt(match[1], 10);
      const count = match[2] ? parseInt(match[2], 10) : 1;
      hunkRanges.push([start, start + count - 1]);
    }

    // If no hunks found, use the entire diff with default range
    if (hunkStarts.length === 0) {
      chunks.push({
        file: filePath,
        lineRange: [1, 1],
        content: fileDiff,
        language,
      });
      continue;
    }

    // Split into separate chunks, one per hunk
    // Extract file header (everything before first @@)
    const headerEnd = hunkStarts[0];
    const fileHeader = fileDiff.slice(0, headerEnd);

    for (let i = 0; i < hunkStarts.length; i++) {
      const hunkStart = hunkStarts[i];
      const hunkEnd = i < hunkStarts.length - 1 ? hunkStarts[i + 1] : fileDiff.length;
      // Include only file header + current hunk (not previous hunks)
      const hunkContent = fileHeader + fileDiff.slice(hunkStart, hunkEnd);

      chunks.push({
        file: filePath,
        lineRange: hunkRanges[i],
        content: hunkContent,
        language,
      });
    }
  }

  return chunks;
}
