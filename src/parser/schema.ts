import { z } from 'zod';

export const SeveritySchema = z.enum(['CRITICAL', 'MAJOR', 'MINOR', 'SUGGESTION']);
export type Severity = z.infer<typeof SeveritySchema>;

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

export interface ParsedReview {
  reviewer: string;
  file: string;
  issues: ReviewIssue[];
  parseFailures: Array<{
    raw: string;
    reason: string;
  }>;
}

export interface ParsingResult {
  success: true;
  review: ParsedReview;
}

export interface ParsingError {
  success: false;
  error: string;
}

export type ParseResult = ParsingResult | ParsingError;
