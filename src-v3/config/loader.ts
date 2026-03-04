/**
 * Config Loader
 * Load and validate .ca/config.json
 */

import { Config, validateConfig, type AgentConfig, type ReviewerEntry } from '../types/config.js';
import { readJson, getConfigPath } from '../utils/fs.js';

// ============================================================================
// Config Loader
// ============================================================================

export async function loadConfig(): Promise<Config> {
  const configPath = getConfigPath();

  try {
    const configJson = await readJson(configPath);
    return validateConfig(configJson);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(
        `Config file not found at ${configPath}. Run setup first.`
      );
    }
    throw error;
  }
}

/**
 * Validate config without loading from file
 */
export function validateConfigData(data: unknown): Config {
  return validateConfig(data);
}

/**
 * Check if a reviewer entry is a static (non-auto) reviewer.
 */
function isStaticReviewer(entry: ReviewerEntry): entry is AgentConfig {
  return !('auto' in entry && entry.auto === true);
}

/**
 * Get enabled static reviewers (excludes auto: true reviewers).
 * Auto reviewers are resolved by L0 in resolveReviewers().
 */
export function getEnabledReviewers(config: Config): AgentConfig[] {
  return config.reviewers.filter(
    (r): r is AgentConfig => isStaticReviewer(r) && r.enabled
  );
}

/**
 * Get all enabled reviewer entries (including auto).
 */
export function getEnabledReviewerEntries(config: Config): ReviewerEntry[] {
  return config.reviewers.filter((r) => r.enabled);
}

/**
 * Get enabled supporters from pool
 */
export function getEnabledSupporters(config: Config) {
  return config.supporters.pool.filter((s) => s.enabled);
}

/**
 * Get Devil's Advocate if enabled
 */
export function getDevilsAdvocate(config: Config) {
  return config.supporters.devilsAdvocate.enabled
    ? config.supporters.devilsAdvocate
    : null;
}

/**
 * Check minimum reviewers requirement
 */
export function checkMinReviewers(
  config: Config,
  minRequired: number = 3
): { valid: boolean; message?: string } {
  const enabled = getEnabledReviewers(config);

  if (enabled.length < minRequired) {
    return {
      valid: false,
      message: `Insufficient reviewers: ${enabled.length} enabled, ${minRequired} required`,
    };
  }

  return { valid: true };
}
