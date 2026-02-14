import { readFile, access } from 'fs/promises';
import { resolve } from 'path';
import { ConfigSchema, type Config, type ValidationResult } from './schema.js';
import { DEFAULT_CONFIG } from './defaults.js';
import chalk from 'chalk';

export async function loadConfig(
  configPath: string = 'oh-my-codereview.config.json'
): Promise<ValidationResult<Config>> {
  const absolutePath = resolve(configPath);

  try {
    // Check if config file exists
    await access(absolutePath);
  } catch {
    return {
      success: false,
      error: `Config file not found: ${configPath}\nRun 'oh-my-codereview init' to create a default config.`,
    };
  }

  try {
    // Read and parse config file
    const content = await readFile(absolutePath, 'utf-8');
    const rawConfig = JSON.parse(content);

    // Validate with zod schema
    const result = ConfigSchema.safeParse(rawConfig);

    if (!result.success) {
      const errors = result.error.issues
        .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
        .join('\n');
      return {
        success: false,
        error: `Invalid config file:\n${errors}`,
      };
    }

    const config = result.data;

    // Validate enabled reviewers count
    const enabledCount = config.reviewers.filter((r) => r.enabled).length;
    if (enabledCount < config.settings.min_reviewers) {
      console.warn(
        chalk.yellow(
          `⚠️  Warning: Only ${enabledCount} reviewers enabled, but min_reviewers is ${config.settings.min_reviewers}`
        )
      );
      console.warn(chalk.yellow('   Review may fail if not enough reviewers are available.\n'));
    }

    return {
      success: true,
      data: config,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: `Invalid JSON in config file: ${error.message}`,
      };
    }

    return {
      success: false,
      error: `Failed to load config: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function getDefaultConfig(): Config {
  return DEFAULT_CONFIG;
}
