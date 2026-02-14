/**
 * CodeAgora Plugin Commands
 * Command handlers for Claude Code slash commands (/agora:*)
 */

import { runPipeline } from '../pipeline/index.js';
import { loadConfig } from '../config/loader.js';
import { getConfiguredProviders, getEnvVarName } from '../llm/config.js';
import type { Provider } from '../llm/types.js';

export interface CommandContext {
  cwd: string;
  args: Record<string, string | boolean>;
}

export interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
}

/**
 * /agora:review - Run multi-agent code review
 */
export async function reviewCommand(ctx: CommandContext): Promise<CommandResult> {
  try {
    console.log('🔍 CodeAgora Multi-Agent Review\n');

    // Determine pipeline options
    const baseBranch = typeof ctx.args.branch === 'string' ? ctx.args.branch : 'main';

    // Note: filePath filtering not yet supported by runPipeline
    // TODO: Add file filtering support to pipeline
    const filePath = typeof ctx.args.file === 'string' ? ctx.args.file : undefined;
    if (filePath) {
      console.warn(`⚠️  File-specific review (--file) not yet implemented, reviewing full diff\n`);
    }

    // Run review pipeline
    const pipelineResult = await runPipeline({
      configPath: ctx.cwd,
      baseBranch,
      enableDebate: true,
      enableSupporters: true,
    });

    // Check if pipeline succeeded
    if (!pipelineResult.success) {
      return {
        success: false,
        output: '',
        error: pipelineResult.error,
      };
    }

    // Format output summary
    // Note: Full review details are printed by the pipeline itself
    let output = '\n━━━ Review Complete ━━━\n\n';
    output += `Files Reviewed: ${pipelineResult.filesReviewed}\n`;
    output += `Files Failed: ${pipelineResult.filesFailed}\n`;
    output += `Duration: ${(pipelineResult.duration / 1000).toFixed(1)}s\n`;
    output += '\n✅ Review completed successfully!\n';
    output += 'See detailed output above for issues and debate results.\n';

    return {
      success: true,
      output,
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * /agora:config - View or update configuration
 */
export async function configCommand(ctx: CommandContext): Promise<CommandResult> {
  try {
    const config = await loadConfig(ctx.cwd);

    let output = '⚙️  CodeAgora Configuration\n\n';

    // Show reviewers
    output += '━━━ Reviewers ━━━\n\n';
    for (const reviewer of config.reviewers) {
      const status = reviewer.enabled ? '✅' : '❌';
      output += `${status} ${reviewer.name}\n`;
      output += `   Provider: ${reviewer.provider}\n`;
      output += `   Model: ${reviewer.model}\n`;
      output += `   Timeout: ${reviewer.timeout}s\n`;
      output += '\n';
    }

    // Show debate settings
    output += '━━━ Debate Settings ━━━\n\n';
    output += `Minimum Reviewers: ${config.min_reviewers || 2}\n`;
    output += `Discord Webhook: ${config.discord_webhook_url ? '✅ Configured' : '❌ Not configured'}\n`;
    output += '\n';

    // Show config file location
    output += `Config file: ${ctx.cwd}/codeagora.config.json\n`;

    return {
      success: true,
      output,
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * /agora:status - Check provider status
 */
export async function statusCommand(_ctx: CommandContext): Promise<CommandResult> {
  try {
    let output = '📊 CodeAgora Provider Status\n\n';

    const configuredProviders = getConfiguredProviders();
    const allProviders: Provider[] = ['anthropic', 'openai', 'google', 'xai', 'minimax', 'kimi'];

    output += '━━━ API Keys ━━━\n\n';

    for (const provider of allProviders) {
      const isConfigured = configuredProviders.includes(provider);
      const status = isConfigured ? '✅' : '❌';
      const envVar = getEnvVarName(provider);

      output += `${status} ${provider.toUpperCase()}\n`;
      output += `   Environment: ${envVar}\n`;
      output += `   Status: ${isConfigured ? 'Configured' : 'Missing'}\n`;
      output += '\n';
    }

    output += '\n━━━ Summary ━━━\n\n';
    output += `Configured: ${configuredProviders.length}/${allProviders.length}\n`;
    output += `Ready to use: ${configuredProviders.map((p) => p.toUpperCase()).join(', ')}\n`;

    return {
      success: true,
      output,
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Main command dispatcher
 */
export async function executeCommand(
  command: string,
  ctx: CommandContext
): Promise<CommandResult> {
  switch (command) {
    case 'review':
      return reviewCommand(ctx);
    case 'config':
      return configCommand(ctx);
    case 'status':
      return statusCommand(ctx);
    default:
      return {
        success: false,
        output: '',
        error: `Unknown command: ${command}. Available: review, config, status`,
      };
  }
}
