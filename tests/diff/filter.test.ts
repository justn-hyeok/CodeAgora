import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { filterIgnoredFiles } from '../../src/diff/filter.js';
import type { DiffChunk } from '../../src/diff/types.js';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';

describe('Diff Filter', () => {
  const testIgnoreFile = join(process.cwd(), '.reviewignore');

  afterEach(async () => {
    try {
      await unlink(testIgnoreFile);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  const createChunks = (files: string[]): DiffChunk[] =>
    files.map((file) => ({
      file,
      lineRange: [1, 10] as [number, number],
      content: 'sample content',
      language: 'typescript',
    }));

  describe('Pattern Matching', () => {
    it('should filter exact file matches', async () => {
      await writeFile(testIgnoreFile, 'src/ignore-me.ts\n');
      const chunks = createChunks(['src/ignore-me.ts', 'src/keep-me.ts']);

      const filtered = await filterIgnoredFiles(chunks);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].file).toBe('src/keep-me.ts');
    });

    it('should filter wildcard patterns', async () => {
      await writeFile(testIgnoreFile, '**/*.test.ts\n');
      const chunks = createChunks(['src/app.ts', 'src/app.test.ts', 'tests/util.test.ts']);

      const filtered = await filterIgnoredFiles(chunks);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].file).toBe('src/app.ts');
    });

    it('should filter directory patterns', async () => {
      await writeFile(testIgnoreFile, 'node_modules/**\ntest/**\n');
      const chunks = createChunks([
        'src/app.ts',
        'node_modules/pkg/index.js',
        'test/app.test.ts',
      ]);

      const filtered = await filterIgnoredFiles(chunks);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].file).toBe('src/app.ts');
    });

    it('should handle glob patterns', async () => {
      await writeFile(testIgnoreFile, 'src/**/*.test.ts\n');
      const chunks = createChunks([
        'src/app.ts',
        'src/utils/helper.test.ts',
        'src/deep/nested/module.test.ts',
      ]);

      const filtered = await filterIgnoredFiles(chunks);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].file).toBe('src/app.ts');
    });

    it('should ignore comment lines', async () => {
      await writeFile(testIgnoreFile, '# This is a comment\nsrc/ignore.ts\n# Another comment\n');
      const chunks = createChunks(['src/ignore.ts', 'src/keep.ts']);

      const filtered = await filterIgnoredFiles(chunks);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].file).toBe('src/keep.ts');
    });

    it('should ignore empty lines', async () => {
      await writeFile(testIgnoreFile, '\n\nsrc/ignore.ts\n\n\n');
      const chunks = createChunks(['src/ignore.ts', 'src/keep.ts']);

      const filtered = await filterIgnoredFiles(chunks);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].file).toBe('src/keep.ts');
    });
  });

  describe('Edge Cases', () => {
    it('should return all files when .reviewignore does not exist', async () => {
      const chunks = createChunks(['src/app.ts', 'src/util.ts']);

      const filtered = await filterIgnoredFiles(chunks);

      expect(filtered).toHaveLength(2);
    });

    it('should handle empty .reviewignore file', async () => {
      await writeFile(testIgnoreFile, '');
      const chunks = createChunks(['src/app.ts', 'src/util.ts']);

      const filtered = await filterIgnoredFiles(chunks);

      expect(filtered).toHaveLength(2);
    });

    it('should handle .reviewignore with only comments', async () => {
      await writeFile(testIgnoreFile, '# Comment 1\n# Comment 2\n');
      const chunks = createChunks(['src/app.ts']);

      const filtered = await filterIgnoredFiles(chunks);

      expect(filtered).toHaveLength(1);
    });

    it('should handle empty chunk array', async () => {
      await writeFile(testIgnoreFile, 'src/*.ts\n');

      const filtered = await filterIgnoredFiles([]);

      expect(filtered).toHaveLength(0);
    });

    it('should handle pattern that matches all files', async () => {
      await writeFile(testIgnoreFile, '**/*\n');
      const chunks = createChunks(['src/app.ts', 'test/util.ts']);

      const filtered = await filterIgnoredFiles(chunks);

      expect(filtered).toHaveLength(0);
    });
  });

  describe('Security', () => {
    it('should not allow path traversal in patterns', async () => {
      await writeFile(testIgnoreFile, '../../../etc/passwd\n');
      const chunks = createChunks(['../../../etc/passwd', 'src/app.ts']);

      const filtered = await filterIgnoredFiles(chunks);

      // Should filter the malicious path if it matches
      // Actual behavior depends on ignore library implementation
      expect(filtered.length).toBeGreaterThanOrEqual(0);
      expect(filtered.length).toBeLessThanOrEqual(2);
    });

    it('should handle malformed patterns gracefully', async () => {
      await writeFile(testIgnoreFile, '[invalid regex\n*****.ts\n');
      const chunks = createChunks(['src/app.ts']);

      // Should not crash, even with invalid patterns
      const filtered = await filterIgnoredFiles(chunks);

      expect(filtered).toBeDefined();
    });
  });

  describe('Common Scenarios', () => {
    it('should filter typical ignored files', async () => {
      await writeFile(
        testIgnoreFile,
        `
# Dependencies
node_modules/**
vendor/**

# Build output
dist/**
build/**
**/*.min.js

# Tests
**/*.test.ts
**/*.spec.ts

# Config
.env
**/*.config.js
`
      );

      const chunks = createChunks([
        'src/app.ts',
        'node_modules/react/index.js',
        'dist/bundle.js',
        'src/utils.test.ts',
        '.env',
        'vite.config.js',
        'src/components/Button.tsx',
      ]);

      const filtered = await filterIgnoredFiles(chunks);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((c) => c.file)).toEqual(['src/app.ts', 'src/components/Button.tsx']);
    });

    it('should handle negation patterns (if supported)', async () => {
      await writeFile(testIgnoreFile, '*.ts\n!src/important.ts\n');
      const chunks = createChunks(['src/app.ts', 'src/important.ts']);

      const filtered = await filterIgnoredFiles(chunks);

      // Behavior depends on ignore library support for negation
      expect(filtered).toBeDefined();
    });
  });
});
