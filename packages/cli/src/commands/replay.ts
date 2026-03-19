/**
 * Session Replay Command (4.4)
 * Re-renders a past session's review output locally (no LLM calls).
 */

import fs from 'fs/promises';
import path from 'path';
import type { EvidenceDocument } from '@codeagora/core/types/core.js';

export interface ReplayResult {
  sessionPath: string;
  decision: string;
  evidenceDocs: EvidenceDocument[];
  diffContent: string | null;
}

/**
 * Load session data for replay.
 */
export async function loadSessionForReplay(baseDir: string, sessionPath: string): Promise<ReplayResult> {
  const [date, id] = sessionPath.split('/');
  if (!date || !id) {
    throw new Error('Session path must be in YYYY-MM-DD/NNN format');
  }

  const sessionDir = path.join(baseDir, '.ca', 'sessions', date, id);

  // Read metadata to get diff path
  let metadata: Record<string, unknown> = {};
  try {
    const raw = await fs.readFile(path.join(sessionDir, 'metadata.json'), 'utf-8');
    metadata = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(`Session not found: ${sessionPath}`);
  }

  // Read head verdict
  let decision = 'unknown';
  try {
    const raw = await fs.readFile(path.join(sessionDir, 'head-verdict.json'), 'utf-8');
    const verdict = JSON.parse(raw) as Record<string, unknown>;
    decision = String(verdict['decision'] ?? 'unknown');
  } catch {
    // No verdict
  }

  // Read evidence docs from result
  let evidenceDocs: EvidenceDocument[] = [];
  try {
    const raw = await fs.readFile(path.join(sessionDir, 'result.json'), 'utf-8');
    const result = JSON.parse(raw) as Record<string, unknown>;
    evidenceDocs = (result['evidenceDocs'] as EvidenceDocument[]) ?? [];
  } catch {
    // Try reading individual review files
    const reviewsDir = path.join(sessionDir, 'reviews');
    try {
      const files = await fs.readdir(reviewsDir);
      for (const file of files.filter(f => f.endsWith('.json'))) {
        try {
          const raw = await fs.readFile(path.join(reviewsDir, file), 'utf-8');
          const review = JSON.parse(raw) as Record<string, unknown>;
          const docs = (review['evidenceDocs'] as EvidenceDocument[]) ?? [];
          evidenceDocs.push(...docs);
        } catch { /* skip */ }
      }
    } catch { /* no reviews */ }
  }

  // Read original diff if available
  let diffContent: string | null = null;
  const diffPath = String(metadata['diffPath'] ?? '');
  if (diffPath) {
    try {
      diffContent = await fs.readFile(diffPath, 'utf-8');
    } catch {
      // Diff file may have been deleted
    }
  }

  return { sessionPath, decision, evidenceDocs, diffContent };
}
