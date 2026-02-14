import { loadConfig } from '../config/loader.js';
import { extractDiff } from '../diff/extractor.js';
import { loadSystemPrompt, generateUserPrompt } from '../reviewer/prompt.js';
import { executeReviewers } from '../reviewer/executor.js';
import { createBackend } from '../reviewer/adapter.js';
import { collectReviews, getSuccessfulReviews } from '../reviewer/collector.js';
import { shouldDebate } from '../debate/judge.js';
import { conductDebate } from '../debate/engine.js';
import { executeSupporters } from '../supporter/executor.js';
import type { SupporterExecutionResult } from '../supporter/types.js';
import { synthesizeReviews } from '../head/synthesizer.js';
import { printTerminalReport } from '../head/reporter.js';
import type { DebateResult } from '../debate/types.js';
import { DiscordClient } from '../discord/client.js';
import {
  formatReviewSummary,
  formatDebateResult,
  formatSupporterResults,
} from '../discord/formatter.js';
import { ReviewHistoryStorage } from '../storage/history.js';
import chalk from 'chalk';
import { readFile, stat } from 'fs/promises';
import crypto from 'crypto';

export interface PipelineOptions {
  configPath?: string;
  diffPath?: string;
  baseBranch?: string;
  enableDebate?: boolean;
  enableSupporters?: boolean;
}

export type PipelineResult =
  | { success: true; duration: number; filesReviewed: number; filesFailed: number }
  | { success: false; error: string; duration: number; filesReviewed: number; filesFailed: number };

export async function runPipeline(options: PipelineOptions = {}): Promise<PipelineResult> {
  const startTime = Date.now();

  try {
    // 1. Load config
    console.log(chalk.blue('📋 Loading configuration...'));
    const configResult = await loadConfig(options.configPath);

    if (!configResult.success) {
      console.error(chalk.red('❌ ' + configResult.error));
      return {
        success: false,
        error: configResult.error,
        duration: Date.now() - startTime,
        filesReviewed: 0,
        filesFailed: 0,
      };
    }

    const config = configResult.data;

    // Initialize Discord client if enabled
    let discordClient: DiscordClient | null = null;
    if (config.discord?.enabled && config.discord.webhook_url) {
      discordClient = new DiscordClient(config.discord.webhook_url);
      console.log(chalk.gray('📢 Discord integration enabled'));
    }

    // Initialize history storage
    const historyStorage = new ReviewHistoryStorage();

    // 2. Extract diff
    console.log(chalk.blue('📄 Extracting diff...'));
    const diffResult = await extractDiff({
      path: options.diffPath,
      baseBranch: options.baseBranch,
    });

    if (!diffResult.success) {
      console.error(chalk.red('❌ ' + diffResult.error));
      return {
        success: false,
        error: diffResult.error,
        duration: Date.now() - startTime,
        filesReviewed: 0,
        filesFailed: 0,
      };
    }

    const chunks = diffResult.chunks;
    console.log(chalk.gray(`  Found ${chunks.length} file(s) to review\n`));

    // Process chunks in parallel batches
    const maxParallelChunks = Math.min(config.settings.max_parallel, chunks.length);
    const batches: typeof chunks[] = [];

    for (let i = 0; i < chunks.length; i += maxParallelChunks) {
      batches.push(chunks.slice(i, i + maxParallelChunks));
    }

    let completedChunks = 0;
    let failedChunks = 0;
    const enabledReviewerCount = config.reviewers.filter((r) => r.enabled).length;
    const allDebateResults: DebateResult[] = [];

    // Load file contents for supporter validation
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit to prevent memory exhaustion
    const fileContents = new Map<string, string>();
    for (const chunk of chunks) {
      try {
        // Check file size before reading
        const fileStat = await stat(chunk.file);
        if (fileStat.size > MAX_FILE_SIZE) {
          console.warn(
            chalk.yellow(`  ⚠️  Skipping large file: ${chunk.file} (${(fileStat.size / 1024 / 1024).toFixed(1)}MB)`)
          );
          fileContents.set(chunk.file, chunk.content); // Fall back to diff content
          continue;
        }

        const content = await readFile(chunk.file, 'utf-8');
        fileContents.set(chunk.file, content);
      } catch {
        // File might not exist in working tree (new file in diff)
        fileContents.set(chunk.file, chunk.content);
      }
    }

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(async (chunk): Promise<boolean> => {
          const chunkStartTime = Date.now();
          console.log(chalk.cyan(`\n🔍 Reviewing: ${chunk.file}`));

          // 3. Load prompts
          const systemPrompt = await loadSystemPrompt();
          const userPrompt = await generateUserPrompt(chunk);

          // 4. Execute reviewers
          console.log(
            chalk.gray(`  Executing ${enabledReviewerCount} reviewer(s)...`)
          );

          // Create backend based on config setting (default: direct)
          const backend = createBackend('opencode', config.settings.backend);

          const executionResult = await executeReviewers(
            config.reviewers,
            {
              chunk,
              systemPrompt,
              userPrompt,
            },
            config.settings.max_parallel,
            backend
          );

          console.log(
            chalk.gray(
              `  ✓ ${executionResult.successful} successful, ${executionResult.failed} failed`
            )
          );

          if (executionResult.successful === 0) {
            console.error(chalk.red('  ❌ All reviewers failed!'));
            return false; // Indicate this chunk failed
          }

          // 5. Parse responses
          const parseResults = collectReviews(chunk.file, executionResult);
          const successfulReviews = getSuccessfulReviews(parseResults);

          console.log(chalk.gray(`  Parsed ${successfulReviews.length} review(s)`));

          // 6. Execute supporters (if enabled)
          let supporterResults: SupporterExecutionResult[] = [];
          if (options.enableSupporters !== false && config.supporters) {
            console.log(chalk.gray(`  Running supporters...`));
            supporterResults = await executeSupporters(
              config.supporters,
              successfulReviews,
              fileContents
            );
            console.log(
              chalk.gray(
                `  ✓ ${supporterResults.filter((r) => r.success).length}/${supporterResults.length} supporters completed`
              )
            );
          }

          // 7. Check debate decision
          const debateDecision = shouldDebate(successfulReviews);
          let chunkDebateResults: DebateResult[] = [];

          // 8. Conduct debate (if required and enabled)
          if (
            options.enableDebate !== false &&
            debateDecision.required &&
            debateDecision.issues.length > 0
          ) {
            console.log(chalk.yellow(`  🗣️  Debate required: ${debateDecision.reason}`));
            chunkDebateResults = await conductDebate(
              debateDecision.issues,
              successfulReviews,
              config.reviewers
            );
            allDebateResults.push(...chunkDebateResults);
          }

          // 9. Synthesize results
          const synthesis = synthesizeReviews(successfulReviews);

          // 10. Generate report
          const duration = Date.now() - chunkStartTime;

          printTerminalReport(chunk.file, synthesis, debateDecision, {
            totalReviewers: enabledReviewerCount,
            successfulReviewers: executionResult.successful,
            duration,
            debateResults: chunkDebateResults,
            supporterResults,
          });

          // 11. Send to Discord if enabled
          if (discordClient) {
            try {
              // Send review summary
              const summaryEmbed = formatReviewSummary(chunk.file, synthesis);
              await discordClient.sendEmbed(summaryEmbed);

              // Send supporter results if any
              if (supporterResults.length > 0) {
                const supporterEmbed = formatSupporterResults(supporterResults);
                await discordClient.sendEmbed(supporterEmbed);
              }

              // Send debate results if any
              if (chunkDebateResults.length > 0) {
                const debateEmbeds = chunkDebateResults.map(formatDebateResult);
                await discordClient.sendEmbeds(debateEmbeds);
              }
            } catch (error) {
              // Don't fail pipeline if Discord fails
              console.warn(
                chalk.yellow(
                  `  ⚠️  Discord send failed: ${error instanceof Error ? error.message : String(error)}`
                )
              );
            }
          }

          // 12. Save to review history
          await historyStorage.save({
            id: crypto.randomUUID(),
            schemaVersion: 1,
            timestamp: Date.now(),
            file: chunk.file,
            reviewers: successfulReviews.map((r) => r.reviewer),
            totalIssues: synthesis.totalIssues,
            severities: synthesis.bySeverity,
            duration,
            debateOccurred: chunkDebateResults.length > 0,
            supportersUsed: supporterResults.length,
          });

          // Optionally save markdown report (disabled for now)
          // if (config.settings.output_format === 'markdown') {
          //   const mdReport = generateMarkdownReport(chunk.file, synthesis, debateDecision, {
          //     totalReviewers: enabledReviewerCount,
          //     successfulReviewers: executionResult.successful,
          //     duration,
          //   });
          //   await writeFile(`review-${chunk.file.replace(/\//g, '-')}.md`, mdReport);
          // }

          return true; // Indicate this chunk succeeded
        })
      );

      // Count failed chunks in this batch
      failedChunks += batchResults.filter((success) => !success).length;

      // Update progress after batch completes (avoid race condition)
      completedChunks += batch.length;
      if (chunks.length > 1) {
        console.log(chalk.gray(`\n  Progress: ${completedChunks}/${chunks.length} files completed`));
      }
    }

    const totalDuration = Date.now() - startTime;

    if (failedChunks > 0) {
      console.log(
        chalk.yellow(
          `\n⚠️  Review completed with failures: ${chunks.length - failedChunks}/${chunks.length} files reviewed successfully`
        )
      );
      return {
        success: false,
        error: `${failedChunks} file(s) failed review - all reviewers failed`,
        duration: totalDuration,
        filesReviewed: chunks.length - failedChunks,
        filesFailed: failedChunks,
      };
    }

    console.log(chalk.green(`\n✅ Review complete! (${(totalDuration / 1000).toFixed(1)}s)`));
    return {
      success: true,
      duration: totalDuration,
      filesReviewed: chunks.length,
      filesFailed: 0,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red('\n❌ Pipeline failed:'));
    console.error(chalk.red(errorMessage));
    return {
      success: false,
      error: errorMessage,
      duration: Date.now() - startTime,
      filesReviewed: 0,
      filesFailed: 0,
    };
  }
}
