import chalk from 'chalk';
import type { Config } from '../config/schema.js';
import fetch from 'node-fetch';
import { getConfiguredProviders } from '../llm/config.js';
import type { Provider } from '../llm/types.js';

interface HealthCheckResult {
  category: string;
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
}

/**
 * Check API key availability for configured providers
 */
function checkAPIKeys(config: Config): HealthCheckResult {
  const configuredProviders = getConfiguredProviders();
  const enabledProviders = new Set(
    config.reviewers.filter((r) => r.enabled).map((r) => r.provider as Provider)
  );

  // Check if all enabled providers have API keys
  const missingKeys: string[] = [];
  for (const provider of enabledProviders) {
    if (!configuredProviders.includes(provider)) {
      missingKeys.push(provider);
    }
  }

  if (missingKeys.length === 0) {
    return {
      category: 'API Keys',
      name: 'Configuration',
      status: 'ok',
      message: `All ${configuredProviders.length} provider(s) configured: ${configuredProviders.join(', ')}`,
    };
  } else {
    return {
      category: 'API Keys',
      name: 'Configuration',
      status: 'error',
      message: `Missing API keys for: ${missingKeys.join(', ')}. Set environment variables.`,
    };
  }
}

/**
 * Check reviewer configurations
 */
function checkReviewers(config: Config): HealthCheckResult[] {
  const results: HealthCheckResult[] = [];
  const enabled = config.reviewers.filter((r) => r.enabled);

  if (enabled.length === 0) {
    results.push({
      category: 'Reviewers',
      name: 'Configuration',
      status: 'error',
      message: 'No reviewers enabled',
    });
    return results;
  }

  if (enabled.length < config.settings.min_reviewers) {
    results.push({
      category: 'Reviewers',
      name: 'Configuration',
      status: 'warning',
      message: `Only ${enabled.length} reviewer(s) enabled, but min_reviewers is ${config.settings.min_reviewers}`,
    });
  } else {
    results.push({
      category: 'Reviewers',
      name: 'Configuration',
      status: 'ok',
      message: `${enabled.length} reviewer(s) enabled`,
    });
  }

  // Check for common provider/model combinations
  const knownCombos = [
    { provider: 'anthropic', models: ['claude-3-5-sonnet-20241022', 'claude-sonnet-4', 'claude-opus-4'] },
    { provider: 'openai', models: ['gpt-4', 'gpt-4-turbo', 'gpt-4o'] },
    { provider: 'google', models: ['gemini-pro', 'gemini-1.5-pro'] },
  ];

  for (const reviewer of enabled) {
    const combo = knownCombos.find((c) => c.provider === reviewer.provider);
    if (combo && !combo.models.includes(reviewer.model)) {
      results.push({
        category: 'Reviewers',
        name: reviewer.name,
        status: 'warning',
        message: `Unknown model '${reviewer.model}' for provider '${reviewer.provider}'`,
      });
    } else {
      results.push({
        category: 'Reviewers',
        name: reviewer.name,
        status: 'ok',
        message: `${reviewer.provider}/${reviewer.model}`,
      });
    }
  }

  return results;
}

/**
 * Check Discord webhook connectivity
 */
async function checkDiscord(config: Config): Promise<HealthCheckResult> {
  if (!config.discord?.enabled) {
    return {
      category: 'Discord',
      name: 'Integration',
      status: 'ok',
      message: 'Discord integration disabled',
    };
  }

  if (!config.discord.webhook_url) {
    return {
      category: 'Discord',
      name: 'Integration',
      status: 'error',
      message: 'Discord enabled but webhook_url not configured',
    };
  }

  try {
    const response = await fetch(config.discord.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '🏥 Health check from oh-my-codereview',
      }),
    });

    if (response.ok) {
      return {
        category: 'Discord',
        name: 'Integration',
        status: 'ok',
        message: 'Webhook is accessible',
      };
    } else {
      return {
        category: 'Discord',
        name: 'Integration',
        status: 'error',
        message: `Webhook returned ${response.status}: ${response.statusText}`,
      };
    }
  } catch (error) {
    return {
      category: 'Discord',
      name: 'Integration',
      status: 'error',
      message: `Failed to reach webhook: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Check GitHub configuration
 */
function checkGitHub(config: Config): HealthCheckResult {
  if (!config.github?.enabled) {
    return {
      category: 'GitHub',
      name: 'Integration',
      status: 'ok',
      message: 'GitHub integration disabled',
    };
  }

  const missing: string[] = [];
  if (!config.github.token) missing.push('token');
  if (!config.github.owner) missing.push('owner');
  if (!config.github.repo) missing.push('repo');

  if (missing.length > 0) {
    return {
      category: 'GitHub',
      name: 'Integration',
      status: 'error',
      message: `Missing required fields: ${missing.join(', ')}`,
    };
  }

  return {
    category: 'GitHub',
    name: 'Integration',
    status: 'ok',
    message: `Configured for ${config.github.owner}/${config.github.repo}`,
  };
}

/**
 * Check supporter configurations
 */
function checkSupporters(config: Config): HealthCheckResult[] {
  if (!config.supporters || !Array.isArray(config.supporters)) {
    return [
      {
        category: 'Supporters',
        name: 'Configuration',
        status: 'ok',
        message: 'No supporters configured',
      },
    ];
  }

  const results: HealthCheckResult[] = [];
  const enabled = config.supporters.filter((s) => s.enabled);

  if (enabled.length === 0) {
    results.push({
      category: 'Supporters',
      name: 'Configuration',
      status: 'ok',
      message: 'No supporters enabled',
    });
    return results;
  }

  results.push({
    category: 'Supporters',
    name: 'Configuration',
    status: 'ok',
    message: `${enabled.length} supporter(s) enabled`,
  });

  for (const supporter of enabled) {
    results.push({
      category: 'Supporters',
      name: supporter.name,
      status: 'ok',
      message: `Categories: ${supporter.categories.join(', ')}`,
    });
  }

  return results;
}

/**
 * Run all health checks
 */
export async function runHealthCheck(config: Config, skipNetwork = false): Promise<void> {
  console.log(chalk.blue('🏥 Running health check...\n'));

  const results: HealthCheckResult[] = [];

  // API Keys check
  results.push(checkAPIKeys(config));

  // Reviewers
  results.push(...checkReviewers(config));

  // Supporters
  results.push(...checkSupporters(config));

  // GitHub
  results.push(checkGitHub(config));

  // Discord (skip if --skip-network)
  if (!skipNetwork) {
    results.push(await checkDiscord(config));
  } else {
    results.push({
      category: 'Discord',
      name: 'Integration',
      status: 'ok',
      message: 'Skipped (--skip-network)',
    });
  }

  // Print results grouped by category
  const categories = [...new Set(results.map((r) => r.category))];

  for (const category of categories) {
    console.log(chalk.bold(`\n${category}:`));
    const categoryResults = results.filter((r) => r.category === category);

    for (const result of categoryResults) {
      const icon =
        result.status === 'ok' ? chalk.green('✓') : result.status === 'warning' ? chalk.yellow('⚠') : chalk.red('✗');

      console.log(`  ${icon} ${result.name}: ${result.message}`);
    }
  }

  // Summary
  const errors = results.filter((r) => r.status === 'error');
  const warnings = results.filter((r) => r.status === 'warning');

  console.log(chalk.bold('\n───────────────────────────────────────'));

  if (errors.length > 0) {
    console.log(chalk.red(`\n❌ Health check failed: ${errors.length} error(s), ${warnings.length} warning(s)`));
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log(chalk.yellow(`\n⚠️  Health check passed with warnings: ${warnings.length} warning(s)`));
  } else {
    console.log(chalk.green('\n✅ All checks passed!'));
  }
}
