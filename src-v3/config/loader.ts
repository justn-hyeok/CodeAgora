/**
 * Config Loader
 * Load and validate .ca/config.json
 */

import { Config, validateConfig } from '../types/config.js';
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
 * Get enabled reviewers
 */
export function getEnabledReviewers(config: Config) {
  return config.reviewers.filter((r) => r.enabled);
}

/**
 * Get enabled supporters
 */
export function getEnabledSupporters(config: Config) {
  return config.supporters.filter((s) => s.enabled);
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
