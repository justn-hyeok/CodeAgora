/**
 * V3 Configuration Schema
 * Based on V3_DESIGN.md config structure
 */

import { z } from 'zod';

// ============================================================================
// Backend Types
// ============================================================================

export const BackendSchema = z.enum(['opencode', 'codex', 'gemini']);
export type Backend = z.infer<typeof BackendSchema>;

// ============================================================================
// Reviewer Config (L1)
// ============================================================================

export const ReviewerConfigSchema = z.object({
  id: z.string(),
  backend: BackendSchema,
  provider: z.string().optional(), // e.g., "kimi", "grok" for OpenCode
  model: z.string(),
  enabled: z.boolean().default(true),
  timeout: z.number().default(120),
});
export type ReviewerConfig = z.infer<typeof ReviewerConfigSchema>;

// ============================================================================
// Supporter Config (L2)
// ============================================================================

export const SupporterConfigSchema = z.object({
  id: z.string(),
  backend: BackendSchema,
  model: z.string(),
  role: z.string(), // e.g., "검증자", "변호사", "검사"
  enabled: z.boolean().default(true),
});
export type SupporterConfig = z.infer<typeof SupporterConfigSchema>;

// ============================================================================
// Moderator Config (L2)
// ============================================================================

export const ModeratorConfigSchema = z.object({
  backend: BackendSchema,
  model: z.string(),
});
export type ModeratorConfig = z.infer<typeof ModeratorConfigSchema>;

// ============================================================================
// Discussion Settings
// ============================================================================

export const DiscussionSettingsSchema = z.object({
  maxRounds: z.number().default(3),
  registrationThreshold: z.object({
    HARSHLY_CRITICAL: z.number().default(1), // 1명 → 즉시 등록
    CRITICAL: z.number().default(1), // 1명 + 서포터 1명
    WARNING: z.number().default(2), // 2명+
    SUGGESTION: z.null(), // Discussion 미등록
  }),
  codeSnippetRange: z.number().default(10), // ±N lines
});
export type DiscussionSettings = z.infer<typeof DiscussionSettingsSchema>;

// ============================================================================
// Error Handling Settings
// ============================================================================

export const ErrorHandlingSchema = z.object({
  maxRetries: z.number().default(2),
  forfeitThreshold: z.number().default(0.7), // 70%+ forfeit → error
});
export type ErrorHandling = z.infer<typeof ErrorHandlingSchema>;

// ============================================================================
// Full Config Schema
// ============================================================================

export const ConfigSchema = z.object({
  reviewers: z.array(ReviewerConfigSchema).min(1),
  supporters: z.array(SupporterConfigSchema).min(1),
  moderator: ModeratorConfigSchema,
  discussion: DiscussionSettingsSchema,
  errorHandling: ErrorHandlingSchema,
});
export type Config = z.infer<typeof ConfigSchema>;

// ============================================================================
// Config Loader
// ============================================================================

export function validateConfig(configJson: unknown): Config {
  return ConfigSchema.parse(configJson);
}
