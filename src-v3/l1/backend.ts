/**
 * L1 Backend Executor
 * Executes backend CLI commands (OpenCode, Codex, Gemini)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type { Backend } from '../types/config.js';

const execAsync = promisify(exec);

// ============================================================================
// Backend Executor
// ============================================================================

export interface BackendInput {
  backend: Backend;
  model: string;
  provider?: string;
  prompt: string;
  timeout: number;
}

/**
 * Execute backend CLI command
 */
export async function executeBackend(input: BackendInput): Promise<string> {
  const { backend, model, provider, prompt, timeout } = input;

  // Write prompt to temp file to avoid shell escaping issues
  const tmpFile = path.join('/tmp', `prompt-${randomUUID()}.txt`);

  try {
    await fs.writeFile(tmpFile, prompt, 'utf-8');

    const command = buildCommand(backend, model, provider, tmpFile);
    const timeoutMs = timeout * 1000;

    const { stdout, stderr } = await execAsync(command, {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    if (stderr && !stdout) {
      throw new Error(`Backend error: ${stderr}`);
    }

    return stdout.trim();
  } catch (error) {
    if (error instanceof Error) {
      if ('code' in error && error.code === 'ETIMEDOUT') {
        throw new Error(`Backend timeout after ${timeout}s`);
      }
      throw new Error(`Backend execution failed: ${error.message}`);
    }
    throw error;
  } finally {
    // Clean up temp file
    try {
      await fs.unlink(tmpFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

// ============================================================================
// Command Builders
// ============================================================================

function buildCommand(
  backend: Backend,
  model: string,
  provider: string | undefined,
  promptFile: string
): string {
  switch (backend) {
    case 'opencode':
      return buildOpenCodeCommand(model, provider, promptFile);
    case 'codex':
      return buildCodexCommand(model, promptFile);
    case 'gemini':
      return buildGeminiCommand(model, promptFile);
    case 'claude':
      return buildClaudeCommand(model, promptFile);
    default:
      throw new Error(`Unsupported backend: ${backend}`);
  }
}

function buildOpenCodeCommand(
  model: string,
  provider: string | undefined,
  promptFile: string
): string {
  // OpenCode CLI: cat prompt.txt | opencode run
  return `cat "${promptFile}" | opencode run`;
}

function buildCodexCommand(model: string, promptFile: string): string {
  // Codex CLI: cat prompt.txt | codex exec
  return `cat "${promptFile}" | codex exec`;
}

function buildGeminiCommand(model: string, promptFile: string): string {
  // Gemini CLI: cat prompt.txt | gemini -p "$(cat prompt.txt)"
  // Note: Gemini -p expects the prompt as argument, so we use command substitution
  return `gemini -p "$(cat "${promptFile}")"`;
}

function buildClaudeCommand(model: string, promptFile: string): string {
  // TODO: Verify actual Claude Code CLI invocation syntax
  // Placeholder implementation - assumes similar pattern to other CLIs
  // Expected: cat prompt.txt | claude [model] [options]
  return `cat "${promptFile}" | claude --model ${model}`;
}
