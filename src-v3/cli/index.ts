#!/usr/bin/env node
/**
 * CodeAgora V3 CLI
 * Multi-agent code review pipeline
 */

import { Command } from 'commander';
import { runPipeline } from '../pipeline/orchestrator.js';
import { loadConfig } from '../config/loader.js';
import path from 'path';
import fs from 'fs/promises';
import { runInit } from './commands/init.js';
import { runDoctor, formatDoctorReport } from './commands/doctor.js';
import { listProviders, formatProviderList } from './commands/providers.js';
import { formatOutput, type OutputFormat } from './formatters/review-output.js';
import { parseReviewerOption, readStdin } from './options/review-options.js';

/**
 * Derive the display name from the invoked binary path.
 * Exported for unit testing.
 */
export function detectBinaryName(argv1: string | undefined): string {
  const base = path.basename(argv1 ?? '');
  return base === 'agora' ? 'agora' : 'codeagora';
}

const displayName = detectBinaryName(process.argv[1]);

const program = new Command();

program
  .name(displayName)
  .description('Multi-LLM collaborative code review CLI')
  .version('3.0.0');

program
  .command('review')
  .description('Run code review pipeline on a diff file')
  .argument('[diff-path]', 'Path to the diff file (use - for stdin)')
  .option('--dry-run', 'Validate config without running review')
  .option('--output <format>', 'Output format: text, json, md, github', 'text')
  .option('--provider <name>', 'Override provider for auto reviewers')
  .option('--model <name>', 'Override model for auto reviewers')
  .option('--verbose', 'Show detailed telemetry output', false)
  .option('--reviewers <value>', 'Number of reviewers or comma-separated names')
  .option('--timeout <seconds>', 'Pipeline timeout in seconds', parseInt)
  .option('--reviewer-timeout <seconds>', 'Per-reviewer timeout in seconds', parseInt)
  .option('--no-discussion', 'Skip L2 discussion phase')
  .action(async (diffPath: string | undefined, options: {
    dryRun?: boolean;
    output: string;
    provider?: string;
    model?: string;
    verbose: boolean;
    reviewers?: string;
    timeout?: number;
    reviewerTimeout?: number;
    discussion: boolean;
  }) => {
    try {
      const outputFormat = (['text', 'json', 'md', 'github'].includes(options.output)
        ? options.output : 'text') as OutputFormat;

      // Handle stdin
      let resolvedPath: string;
      if (diffPath === '-' || (!diffPath && !process.stdin.isTTY)) {
        const stdinContent = await readStdin();
        const tmpPath = path.join(process.cwd(), '.ca', 'tmp-stdin-diff.patch');
        await fs.mkdir(path.dirname(tmpPath), { recursive: true });
        await fs.writeFile(tmpPath, stdinContent);
        resolvedPath = tmpPath;
      } else if (diffPath) {
        resolvedPath = path.resolve(diffPath);
      } else {
        console.error('Error: diff-path required (or pipe via stdin)');
        process.exit(1);
      }

      // Check diff file exists
      try {
        await fs.access(resolvedPath);
      } catch {
        console.error(`Error: Diff file not found: ${resolvedPath}`);
        process.exit(1);
      }

      if (options.dryRun) {
        console.log('Validating config...');
        const config = await loadConfig();
        console.log('Config valid.');
        console.log(`  Reviewers: ${Array.isArray(config.reviewers) ? config.reviewers.length : config.reviewers.count}`);
        console.log(`  Supporters: ${config.supporters.pool.length}`);
        console.log(`  Max rounds: ${config.discussion.maxRounds}`);
        return;
      }

      // Parse --reviewers if provided
      if (options.reviewers) {
        const _parsed = parseReviewerOption(options.reviewers);
        // TODO: pass parsed reviewer selection to pipeline
      }

      if (options.verbose) {
        console.log(`Starting review: ${resolvedPath}`);
        if (options.provider) console.log(`  Provider override: ${options.provider}`);
        if (options.model) console.log(`  Model override: ${options.model}`);
        if (options.timeout) console.log(`  Pipeline timeout: ${options.timeout}s`);
        if (options.reviewerTimeout) console.log(`  Reviewer timeout: ${options.reviewerTimeout}s`);
        if (!options.discussion) console.log(`  Discussion: skipped`);
        console.log('---');
      }

      const result = await runPipeline({ diffPath: resolvedPath });

      console.log(formatOutput(result, outputFormat));

      if (result.status !== 'success') {
        process.exit(1);
      }
    } catch (error) {
      console.error('Fatal error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Validate and display current config')
  .action(async () => {
    try {
      const config = await loadConfig();
      console.log('Config: .ca/config.json');
      console.log(JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Config error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize CodeAgora in current project')
  .option('--format <format>', 'Config format (json or yaml)', 'json')
  .option('--force', 'Overwrite existing files', false)
  .action(async (options: { format: string; force: boolean }) => {
    try {
      const format = options.format === 'yaml' ? 'yaml' : 'json';
      const result = await runInit({ format, force: options.force, baseDir: process.cwd() });
      for (const f of result.created) {
        console.log(`  created: ${f}`);
      }
      for (const f of result.skipped) {
        console.log(`  skipped: ${f} (already exists, use --force to overwrite)`);
      }
      for (const w of result.warnings) {
        console.warn(`  warning: ${w}`);
      }
      if (result.created.length > 0) {
        console.log('CodeAgora initialized successfully.');
      }
    } catch (error) {
      console.error('Init failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('doctor')
  .description('Check environment and configuration')
  .action(async () => {
    try {
      const result = await runDoctor(process.cwd());
      console.log(formatDoctorReport(result));
      if (result.summary.fail > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error('Doctor failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('providers')
  .description('List supported providers and API key status')
  .action(() => {
    const providers = listProviders();
    console.log(formatProviderList(providers));
  });

// Only parse argv when this file is the direct entry point (not imported by tests).
// In ESM the canonical check is comparing import.meta.url to the process entry module.
// A simpler cross-env guard: skip parse when NODE_ENV is 'test' and argv hasn't been
// explicitly set beyond the two node/script entries.
if (process.env.NODE_ENV !== 'test') {
  program.parse();
}
