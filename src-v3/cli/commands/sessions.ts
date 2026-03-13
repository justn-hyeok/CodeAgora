/**
 * Sessions Command
 * List, show, and diff past review sessions.
 */

import fs from 'fs/promises';
import path from 'path';

// ============================================================================
// Types
// ============================================================================

export interface SessionEntry {
  id: string;        // "2026-03-13/001"
  date: string;
  sessionId: string;
  status: string;    // from metadata
  dirPath: string;
}

export interface SessionDetail {
  entry: SessionEntry;
  metadata?: Record<string, unknown>;
  verdict?: Record<string, unknown>;
}

export interface SessionDiff {
  session1: string;
  session2: string;
  added: string[];    // issues only in session2
  removed: string[];  // issues only in session1
  unchanged: number;
}

// ============================================================================
// Helpers
// ============================================================================

async function readJsonFile(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractIssues(verdict: Record<string, unknown>): string[] {
  // Try common verdict shapes: issues[], findings[], items[]
  for (const key of ['issues', 'findings', 'items']) {
    const val = verdict[key];
    if (Array.isArray(val)) {
      return val.map((item: unknown) => {
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>;
          return String(obj['title'] ?? obj['description'] ?? obj['message'] ?? JSON.stringify(item));
        }
        return String(item);
      });
    }
  }
  return [];
}

// ============================================================================
// Public API
// ============================================================================

/**
 * List sessions under baseDir/.ca/sessions/, newest first, up to limit (default 10).
 */
export async function listSessions(
  baseDir: string,
  options?: { limit?: number }
): Promise<SessionEntry[]> {
  const limit = options?.limit ?? 10;
  const sessionsDir = path.join(baseDir, '.ca', 'sessions');

  let dateDirs: string[];
  try {
    const entries = await fs.readdir(sessionsDir);
    dateDirs = entries.sort().reverse(); // newest date first
  } catch {
    return [];
  }

  const results: SessionEntry[] = [];

  for (const dateDir of dateDirs) {
    const datePath = path.join(sessionsDir, dateDir);
    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(datePath);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;

    let sessionIds: string[];
    try {
      const entries = await fs.readdir(datePath);
      sessionIds = entries.sort().reverse(); // newest session first within date
    } catch {
      continue;
    }

    for (const sessionId of sessionIds) {
      const sessionPath = path.join(datePath, sessionId);
      let sStat: Awaited<ReturnType<typeof fs.stat>>;
      try {
        sStat = await fs.stat(sessionPath);
      } catch {
        continue;
      }
      if (!sStat.isDirectory()) continue;

      const metadataPath = path.join(sessionPath, 'metadata.json');
      const metadata = await readJsonFile(metadataPath);
      const status = metadata && typeof metadata['status'] === 'string'
        ? metadata['status']
        : 'unknown';

      results.push({
        id: `${dateDir}/${sessionId}`,
        date: dateDir,
        sessionId,
        status,
        dirPath: sessionPath,
      });

      if (results.length >= limit) {
        return results;
      }
    }
  }

  return results;
}

/**
 * Show details for a session identified by "YYYY-MM-DD/NNN".
 * Throws if the session directory does not exist.
 */
export async function showSession(
  baseDir: string,
  sessionPath: string
): Promise<SessionDetail> {
  const parts = sessionPath.split('/');
  if (parts.length < 2) {
    throw new Error(`Invalid session path format: "${sessionPath}". Expected "YYYY-MM-DD/NNN".`);
  }
  const date = parts[0];
  const sessionId = parts.slice(1).join('/');

  const dirPath = path.join(baseDir, '.ca', 'sessions', date, sessionId);

  try {
    await fs.access(dirPath);
  } catch {
    throw new Error(`Session not found: ${sessionPath}`);
  }

  const metadata = await readJsonFile(path.join(dirPath, 'metadata.json')) ?? undefined;
  const verdict = await readJsonFile(path.join(dirPath, 'head-verdict.json')) ?? undefined;

  const status = metadata && typeof metadata['status'] === 'string'
    ? metadata['status']
    : 'unknown';

  const entry: SessionEntry = {
    id: sessionPath,
    date,
    sessionId,
    status,
    dirPath,
  };

  return { entry, metadata, verdict };
}

/**
 * Diff two sessions, comparing their verdict issue titles.
 */
export async function diffSessions(
  baseDir: string,
  session1: string,
  session2: string
): Promise<SessionDiff> {
  const [detail1, detail2] = await Promise.all([
    showSession(baseDir, session1),
    showSession(baseDir, session2),
  ]);

  const issues1 = detail1.verdict ? extractIssues(detail1.verdict) : [];
  const issues2 = detail2.verdict ? extractIssues(detail2.verdict) : [];

  const set1 = new Set(issues1);
  const set2 = new Set(issues2);

  const removed = issues1.filter((t) => !set2.has(t));
  const added = issues2.filter((t) => !set1.has(t));
  const unchanged = issues1.filter((t) => set2.has(t)).length;

  return { session1, session2, added, removed, unchanged };
}

// ============================================================================
// Formatters
// ============================================================================

export function formatSessionList(sessions: SessionEntry[]): string {
  if (sessions.length === 0) {
    return 'No sessions found.';
  }

  const COL_SESSION = 28;
  const COL_DATE = 14;

  const header =
    'Session'.padEnd(COL_SESSION) +
    'Date'.padEnd(COL_DATE) +
    'Status';
  const divider = '\u2500'.repeat(COL_SESSION + COL_DATE + 12);

  const rows = sessions.map((s) =>
    s.id.padEnd(COL_SESSION) +
    s.date.padEnd(COL_DATE) +
    s.status
  );

  return [header, divider, ...rows].join('\n');
}

export function formatSessionDetail(detail: SessionDetail): string {
  const lines: string[] = [];
  lines.push(`Session: ${detail.entry.id}`);
  lines.push(`Status:  ${detail.entry.status}`);
  lines.push(`Date:    ${detail.entry.date}`);

  if (detail.metadata) {
    const m = detail.metadata;
    if (typeof m['diffPath'] === 'string') {
      lines.push(`Diff:    ${m['diffPath']}`);
    }
    if (typeof m['timestamp'] === 'number') {
      lines.push(`Started: ${new Date(m['timestamp']).toISOString()}`);
    }
    if (typeof m['completedAt'] === 'number') {
      lines.push(`Completed: ${new Date(m['completedAt']).toISOString()}`);
    }
  }

  if (detail.verdict) {
    const issues = extractIssues(detail.verdict);
    lines.push(`Issues:  ${issues.length}`);
    if (issues.length > 0) {
      for (const issue of issues.slice(0, 5)) {
        lines.push(`  - ${issue}`);
      }
      if (issues.length > 5) {
        lines.push(`  ... and ${issues.length - 5} more`);
      }
    }
  }

  return lines.join('\n');
}

export function formatSessionDiff(diff: SessionDiff): string {
  const lines: string[] = [];
  lines.push(`Comparing ${diff.session1} vs ${diff.session2}`);
  lines.push(`New: ${diff.added.length}, Resolved: ${diff.removed.length}, Unchanged: ${diff.unchanged}`);

  if (diff.added.length > 0) {
    lines.push('');
    lines.push('New issues:');
    for (const issue of diff.added) {
      lines.push(`  + ${issue}`);
    }
  }

  if (diff.removed.length > 0) {
    lines.push('');
    lines.push('Resolved issues:');
    for (const issue of diff.removed) {
      lines.push(`  - ${issue}`);
    }
  }

  return lines.join('\n');
}
