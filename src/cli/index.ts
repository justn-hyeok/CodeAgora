#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { writeFile, access } from 'fs/promises';
import { generateDefaultConfig } from '../config/defaults.js';
import { ReviewHistoryStorage } from '../storage/history.js';
import { generateStats, formatStatsReport } from '../stats/generator.js';
import { runHealthCheck } from './health.js';
import { loadConfig } from '../config/loader.js';

const program = new Command();

program
  .name('oh-my-codereview')
  .description('Multi-LLM collaborative code review pipeline')
  .version('0.1.0');

program
  .command('review')
  .description('Review code changes')
  .argument('[path]', 'Path to diff file')
  .option('--base <branch>', 'Base branch for git diff', 'main')
  .option('--config <path>', 'Path to config file', 'oh-my-codereview.config.json')
  .action(async (path, options) => {
    const { runPipeline } = await import('../pipeline/index.js');

    const result = await runPipeline({
      configPath: options.config,
      diffPath: path,
      baseBranch: options.base,
    });

    if (!result.success) {
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize config file')
  .option('-f, --force', 'Overwrite existing config file')
  .action(async (options) => {
    console.log(chalk.blue('📝 Initializing config file...'));

    const configPath = 'oh-my-codereview.config.json';

    try {
      // Check if config already exists
      if (!options.force) {
        try {
          await access(configPath);
          console.log(chalk.yellow('⚠️  Config file already exists!'));
          console.log(chalk.gray('Use --force to overwrite'));
          return;
        } catch {
          // File doesn't exist, continue
        }
      }

      // Generate and write default config
      const defaultConfig = generateDefaultConfig();
      await writeFile(configPath, defaultConfig);

      console.log(chalk.green('✅ Config file created: ' + configPath));
      console.log(chalk.gray('\nEdit the config to customize reviewers and settings.'));
    } catch (error) {
      console.error(chalk.red('❌ Failed to create config file'));
      console.error(chalk.gray(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('Show review statistics')
  .option('--last <count>', 'Show stats for last N reviews', '0')
  .action(async (options) => {
    try {
      const storage = new ReviewHistoryStorage();
      const count = Number(options.last);

      if (!Number.isInteger(count) || count < 0) {
        console.error(chalk.red(`❌ Invalid --last value: "${options.last}"`));
        console.error(chalk.gray('Expected a non-negative integer (e.g., --last 10)'));
        process.exit(1);
      }

      const history = count > 0 ? await storage.getLast(count) : await storage.load();

      if (history.length === 0) {
        console.log(chalk.yellow('📊 No review history found'));
        console.log(chalk.gray('\nRun some reviews to build history!'));
        return;
      }

      const stats = generateStats(history);
      const report = formatStatsReport(stats);

      console.log(report);
    } catch (error) {
      console.error(chalk.red('❌ Failed to generate stats'));
      console.error(chalk.gray(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('health')
  .description('Run health check on configuration')
  .option('--config <path>', 'Path to config file', 'oh-my-codereview.config.json')
  .option('--skip-network', 'Skip network checks (Discord webhook)', false)
  .action(async (options) => {
    try {
      console.log(chalk.blue('📋 Loading configuration...'));
      const configResult = await loadConfig(options.config);

      if (!configResult.success) {
        console.error(chalk.red('❌ ' + configResult.error));
        process.exit(1);
      }

      await runHealthCheck(configResult.data, options.skipNetwork);
    } catch (error) {
      console.error(chalk.red('❌ Health check failed'));
      console.error(chalk.gray(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program.parse();
