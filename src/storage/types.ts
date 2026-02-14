import { z } from 'zod';
import { SeveritySchema } from '../parser/schema.js';
import type { Severity } from '../parser/schema.js';

/**
 * Zod schema for review history entry
 */
export const ReviewHistoryEntrySchema = z.object({
  id: z.string(),
  schemaVersion: z.number(),
  timestamp: z.number(),
  file: z.string(),
  reviewers: z.array(z.string()),
  totalIssues: z.number(),
  severities: z.record(SeveritySchema, z.number()),
  duration: z.number(),
  debateOccurred: z.boolean(),
  supportersUsed: z.number(),
});

/**
 * Single review history entry
 */
export interface ReviewHistoryEntry {
  id: string;
  schemaVersion: number;
  timestamp: number;
  file: string;
  reviewers: string[];
  totalIssues: number;
  severities: Record<Severity, number>;
  duration: number;
  debateOccurred: boolean;
  supportersUsed: number;
}

/**
 * Aggregated review statistics
 */
export interface ReviewStats {
  totalReviews: number;
  totalIssues: number;
  totalFiles: number;
  averageDuration: number;
  averageIssuesPerReview: number;
  issuesBySeverity: Record<Severity, number>;
  reviewerUsage: Record<string, number>;
  debateCount: number;
  supporterCount: number;
}
