/**
 * L3 Head - Diff Grouping (Bookend Start)
 * Groups git diff into logical file groups for reviewer distribution
 */

export interface FileGroup {
  name: string;
  files: string[];
  diffContent: string;
  prSummary: string;
}

/**
 * Analyze git diff and group files logically
 * This is a simplified version - in production, Head (Claude Code) does this analysis
 */
export function groupDiff(diffContent: string): FileGroup[] {
  const files = extractFilesFromDiff(diffContent);

  // Simple grouping strategy: by directory
  const groups = new Map<string, string[]>();

  for (const file of files) {
    const dir = file.split('/')[0] || 'root';
    if (!groups.has(dir)) {
      groups.set(dir, []);
    }
    groups.get(dir)!.push(file);
  }

  // Create file groups
  const fileGroups: FileGroup[] = [];

  for (const [dir, fileList] of groups) {
    const groupDiff = extractGroupDiff(diffContent, fileList);

    fileGroups.push({
      name: dir,
      files: fileList,
      diffContent: groupDiff,
      prSummary: `Changes in ${dir}/ directory (${fileList.length} file(s))`,
    });
  }

  return fileGroups;
}

/**
 * Extract file paths from git diff
 */
function extractFilesFromDiff(diff: string): string[] {
  const files = new Set<string>();
  const lines = diff.split('\n');

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      const match = line.match(/diff --git a\/(.+?) b\/(.+)/);
      if (match) {
        files.add(match[2]);
      }
    }
  }

  return Array.from(files);
}

/**
 * Extract diff content for specific files
 */
function extractGroupDiff(fullDiff: string, files: string[]): string {
  const sections: string[] = [];
  const diffSections = fullDiff.split(/(?=diff --git)/);

  for (const section of diffSections) {
    for (const file of files) {
      if (section.includes(`b/${file}`)) {
        sections.push(section);
        break;
      }
    }
  }

  return sections.join('\n');
}
