/**
 * Core type definitions for CodeAgora tools
 */

import { z } from 'zod';

// Severity 타입 (새 스펙 - lowercase)
export const SeveritySchema = z.enum(['critical', 'warning', 'suggestion', 'nitpick']);
export type Severity = z.infer<typeof SeveritySchema>;

// ReviewIssue 타입
export const ReviewIssueSchema = z.object({
  severity: SeveritySchema,
  category: z.string(),
  line: z.number().int().positive(),
  lineEnd: z.number().int().positive().optional(),
  title: z.string(),
  description: z.string().optional(),
  suggestion: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0.5),
});
export type ReviewIssue = z.infer<typeof ReviewIssueSchema>;

// ParsedReview 타입
export interface ParsedReview {
  reviewer: string;
  file: string;
  issues: ReviewIssue[];
  parseFailures: Array<{
    raw: string;
    reason: string;
  }>;
}

// ParsedIssueBlock (파서 내부 사용)
export interface ParsedIssueBlock {
  severity: Severity;
  category: string;
  line: number;
  lineEnd?: number;
  title: string;
  description?: string;
  suggestion?: string;
  confidence: number;
  parseSuccess: boolean;
  raw?: string;
  parseError?: string;
}

// CLI 입/출력 스키마

// parse-reviews command
export const ParseReviewsInputSchema = z.object({
  reviews: z.array(
    z.object({
      reviewer: z.string(),
      file: z.string(),
      response: z.string(),
    })
  ),
});
export type ParseReviewsInput = z.infer<typeof ParseReviewsInputSchema>;

export interface ParseReviewsOutput {
  parsedReviews: ParsedReview[];
}

// voting command
export const VotingInputSchema = z.object({
  reviews: z.array(z.any()), // ParsedReview[] (any for runtime flexibility)
  threshold: z.number().min(0).max(1).default(0.75),
});
export type VotingInput = z.infer<typeof VotingInputSchema>;

export interface IssueGroup {
  file: string;
  line: number;
  lineEnd?: number;
  title: string;
}

export interface ConsensusIssue {
  issueGroup: IssueGroup;
  agreedSeverity: Severity;
  confidence: number;
  debateRequired: false;
  voters: string[];
  suggestions?: string[];
}

export interface DebateIssue {
  issueGroup: IssueGroup;
  severityDistribution: Record<Severity, number>;
  confidence: number;
  debateRequired: true;
  opinions: Array<{
    reviewer: string;
    severity: Severity;
    confidence: number;
    description?: string;
    suggestion?: string;
  }>;
}

export interface VotingOutput {
  consensusIssues: ConsensusIssue[];
  debateIssues: DebateIssue[];
  stats: {
    totalIssueGroups: number;
    consensus: number;
    needsDebate: number;
  };
}

// anonymize command
export const AnonymizeInputSchema = z.object({
  opinions: z.array(
    z.object({
      reviewer: z.string(),
      severity: z.string(),
      reasoning: z.string(),
    })
  ),
});
export type AnonymizeInput = z.infer<typeof AnonymizeInputSchema>;

export interface AnonymizeOutput {
  anonymized: string;
}

// score command
export const ScoreInputSchema = z.object({
  reasoning: z.string(),
});
export type ScoreInput = z.infer<typeof ScoreInputSchema>;

export interface ScoreOutput {
  score: number;
  breakdown: {
    codeReference: boolean;
    technicalDepth: boolean;
    evidenceBased: boolean;
    specificExamples: boolean;
    codeSnippets: boolean;
  };
}

// early-stop command
export interface DebateParticipant {
  reviewer: string;
  rounds: Array<{
    round: number;
    reasoning: string;
    severity: Severity;
  }>;
}

export const EarlyStopInputSchema = z.object({
  participants: z.array(z.any()), // DebateParticipant[]
  minRounds: z.number().int().positive().default(2),
  similarityThreshold: z.number().min(0).max(1).default(0.9),
});
export type EarlyStopInput = z.infer<typeof EarlyStopInputSchema>;

export interface EarlyStopOutput {
  shouldStop: boolean;
  reason?: string;
  similarities?: Record<string, number>;
}

// format-output command
export const FormatOutputInputSchema = z.object({
  consensusIssues: z.array(z.any()),
  debateIssues: z.array(z.any()),
  debateResults: z.array(z.any()).optional(),
});
export type FormatOutputInput = z.infer<typeof FormatOutputInputSchema>;

export interface FormatOutputOutput {
  markdown: string;
  summary: {
    totalIssues: number;
    bySeverity: Record<Severity, number>;
    debatesHeld: number;
  };
}
