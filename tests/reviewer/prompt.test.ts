import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadSystemPrompt,
  loadUserPromptTemplate,
  generateUserPrompt,
  clearPromptCache,
} from '../../src/reviewer/prompt.js';
import type { DiffChunk } from '../../src/diff/types.js';

describe('Prompt Loader', () => {
  beforeEach(() => {
    clearPromptCache();
  });

  it('should load system prompt', async () => {
    const prompt = await loadSystemPrompt();

    expect(prompt).toBeTruthy();
    expect(prompt).toContain('code reviewer');
    expect(prompt).toContain('CRITICAL');
    expect(prompt).toContain('MAJOR');
  });

  it('should load user prompt template', async () => {
    const template = await loadUserPromptTemplate();

    expect(template).toBeTruthy();
    expect(template).toContain('{{FILE}}');
    expect(template).toContain('{{LANGUAGE}}');
    expect(template).toContain('{{DIFF}}');
  });

  it('should generate user prompt with placeholders replaced', async () => {
    const chunk: DiffChunk = {
      file: 'src/test.ts',
      language: 'typescript',
      lineRange: [1, 10],
      content: 'diff content here',
    };

    const prompt = await generateUserPrompt(chunk);

    expect(prompt).toContain('src/test.ts');
    expect(prompt).toContain('typescript');
    expect(prompt).toContain('diff content here');
    expect(prompt).not.toContain('{{FILE}}');
    expect(prompt).not.toContain('{{LANGUAGE}}');
    expect(prompt).not.toContain('{{DIFF}}');
  });

  it('should cache prompts on subsequent calls', async () => {
    const prompt1 = await loadSystemPrompt();
    const prompt2 = await loadSystemPrompt();

    expect(prompt1).toBe(prompt2); // Same reference = cached
  });

  it('should clear cache', async () => {
    await loadSystemPrompt();
    clearPromptCache();

    // Should reload after cache clear
    const prompt = await loadSystemPrompt();
    expect(prompt).toBeTruthy();
  });
});
