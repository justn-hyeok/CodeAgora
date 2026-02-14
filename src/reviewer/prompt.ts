import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { DiffChunk } from '../diff/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(__dirname, '../../prompts');

let systemPromptCache: string | null = null;
let userPromptTemplateCache: string | null = null;

export async function loadSystemPrompt(): Promise<string> {
  if (systemPromptCache) {
    return systemPromptCache;
  }

  const promptPath = join(PROMPTS_DIR, 'reviewer-system.md');

  try {
    systemPromptCache = await readFile(promptPath, 'utf-8');
    return systemPromptCache;
  } catch (error) {
    throw new Error(
      `Failed to load system prompt: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function loadUserPromptTemplate(): Promise<string> {
  if (userPromptTemplateCache) {
    return userPromptTemplateCache;
  }

  const promptPath = join(PROMPTS_DIR, 'reviewer-user.md');

  try {
    userPromptTemplateCache = await readFile(promptPath, 'utf-8');
    return userPromptTemplateCache;
  } catch (error) {
    throw new Error(
      `Failed to load user prompt template: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function generateUserPrompt(chunk: DiffChunk): Promise<string> {
  const template = await loadUserPromptTemplate();

  // Use function replacer to avoid $ special character issues in replacement strings
  return template
    .replace('{{FILE}}', () => chunk.file)
    .replace('{{LANGUAGE}}', () => chunk.language)
    .replace('{{DIFF}}', () => chunk.content);
}

export function clearPromptCache(): void {
  systemPromptCache = null;
  userPromptTemplateCache = null;
}
