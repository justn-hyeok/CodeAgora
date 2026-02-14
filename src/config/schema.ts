import { z } from 'zod';

// Reviewer schema
export const ReviewerSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Reviewer name must contain only alphanumeric characters, hyphens, and underscores'
    ),
  provider: z
    .string()
    .min(1)
    .max(64)
    .regex(
      /^[a-zA-Z0-9_\-]+$/,
      'Provider must contain only alphanumeric characters, hyphens, and underscores'
    ),
  model: z
    .string()
    .min(1)
    .max(128)
    .regex(
      /^[a-zA-Z0-9_\-\.\/]+$/,
      'Model must contain only alphanumeric characters, hyphens, underscores, dots, and slashes'
    ),
  enabled: z.boolean().default(true),
  timeout: z.number().positive().max(3600).default(300),
});

export type Reviewer = z.infer<typeof ReviewerSchema>;

// Head agent schema
export const HeadAgentSchema = z.object({
  provider: z
    .string()
    .min(1)
    .max(64)
    .regex(
      /^[a-zA-Z0-9_\-]+$/,
      'Provider must contain only alphanumeric characters, hyphens, and underscores'
    ),
  model: z
    .string()
    .min(1)
    .max(128)
    .regex(
      /^[a-zA-Z0-9_\-\.\/]+$/,
      'Model must contain only alphanumeric characters, hyphens, underscores, dots, and slashes'
    ),
  fallback_model: z
    .string()
    .max(128)
    .regex(
      /^[a-zA-Z0-9_\-\.\/]+$/,
      'Model must contain only alphanumeric characters, hyphens, underscores, dots, and slashes'
    )
    .optional(),
});

export type HeadAgent = z.infer<typeof HeadAgentSchema>;

// Supporter schema
export const SupporterSchema = z.object({
  provider: z
    .string()
    .min(1)
    .max(64)
    .regex(
      /^[a-zA-Z0-9_\-]+$/,
      'Provider must contain only alphanumeric characters, hyphens, and underscores'
    ),
  model: z
    .string()
    .min(1)
    .max(128)
    .regex(
      /^[a-zA-Z0-9_\-\.\/]+$/,
      'Model must contain only alphanumeric characters, hyphens, underscores, dots, and slashes'
    ),
  enabled: z.boolean().default(false),
});

export type Supporter = z.infer<typeof SupporterSchema>;

// Discord schema
export const DiscordSchema = z.object({
  enabled: z.boolean().default(false),
  webhook_url: z
    .string()
    .url()
    .refine(
      (url) =>
        /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(url),
      'Must be a valid Discord webhook URL (https://discord.com/api/webhooks/...)'
    )
    .optional(),
});

export type Discord = z.infer<typeof DiscordSchema>;

// Settings schema
export const SettingsSchema = z.object({
  min_reviewers: z.number().int().positive().default(3),
  max_parallel: z.number().int().positive().max(20).default(5),
  output_format: z.enum(['json', 'text', 'markdown']).default('markdown'),
  default_timeout: z.number().positive().default(300),
  backend: z.enum(['direct', 'opencode']).default('direct'),
});

export type Settings = z.infer<typeof SettingsSchema>;

// Main config schema
export const ConfigSchema = z.object({
  head_agent: HeadAgentSchema,
  supporters: z.object({
    codex: SupporterSchema.optional(),
    gemini: SupporterSchema.optional(),
  }).optional().default({}),
  discord: DiscordSchema.optional().default({ enabled: false }),
  reviewers: z.array(ReviewerSchema).min(1),
  settings: SettingsSchema.optional().transform((val) => ({
    min_reviewers: val?.min_reviewers ?? 3,
    max_parallel: val?.max_parallel ?? 5,
    output_format: val?.output_format ?? 'markdown',
    default_timeout: val?.default_timeout ?? 300,
    backend: val?.backend ?? 'direct',
  })),
});

export type Config = z.infer<typeof ConfigSchema>;

// Validation result type
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
