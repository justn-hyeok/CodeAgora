/**
 * E2E Pipeline Test
 * Tests complete V3 pipeline with mock backends
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runPipeline } from '../pipeline/orchestrator.js';
import fs from 'fs/promises';
import path from 'path';
import * as backend from '../l1/backend.js';

describe('E2E Pipeline', () => {
  const testDiffPath = '/tmp/test-v3-diff.txt';
  const testDiff = `diff --git a/auth.ts b/auth.ts
index 123..456 789
--- a/auth.ts
+++ b/auth.ts
@@ -10,5 +10,5 @@
-const query = "SELECT * FROM users WHERE username = '" + username + "'";
+const query = \`SELECT * FROM users WHERE username = '\${username}'\`;
`;

  const mockConfig = {
    reviewers: [
      { id: 'r1', backend: 'codex', model: 'test', enabled: true, timeout: 120 },
      { id: 'r2', backend: 'codex', model: 'test', enabled: true, timeout: 120 },
      { id: 'r3', backend: 'codex', model: 'test', enabled: true, timeout: 120 },
    ],
    supporters: {
      pool: [
        { id: 'sp1', backend: 'codex', model: 'test', enabled: true, timeout: 120 },
        { id: 'sp2', backend: 'codex', model: 'test', enabled: true, timeout: 120 },
      ],
      pickCount: 2,
      pickStrategy: 'random',
      devilsAdvocate: {
        id: 's-devil',
        backend: 'codex',
        model: 'test',
        enabled: true,
        timeout: 120,
      },
      personaPool: ['/tmp/test-persona.md'],
      personaAssignment: 'random',
    },
    moderator: { backend: 'codex', model: 'test' },
    discussion: {
      maxRounds: 3,
      registrationThreshold: {
        HARSHLY_CRITICAL: 1,
        CRITICAL: 1,
        WARNING: 2,
        SUGGESTION: null,
      },
      codeSnippetRange: 10,
    },
    errorHandling: { maxRetries: 2, forfeitThreshold: 0.7 },
  };

  beforeEach(async () => {
    // Clean up before each test to avoid interference
    await fs.rm('.ca', { recursive: true, force: true }).catch(() => {});

    // Create test diff
    await fs.writeFile(testDiffPath, testDiff, 'utf-8');

    // Create test persona
    await fs.writeFile('/tmp/test-persona.md', '# Test Persona\nYou are a test reviewer.', 'utf-8');

    // Create mock config
    await fs.mkdir('.ca', { recursive: true });
    await fs.writeFile('.ca/config.json', JSON.stringify(mockConfig));

    // Mock backend executor
    vi.spyOn(backend, 'executeBackend').mockResolvedValue(`
## Issue: SQL Injection Risk

### 문제
In auth.ts:10, template literal doesn't prevent SQL injection

### 근거
1. User input is still not sanitized
2. Template literals don't escape SQL
3. Should use parameterized queries

### 심각도
CRITICAL

### 제안
Use prepared statements: db.query('SELECT * FROM users WHERE username = ?', [username])
    `);
  });

  afterEach(async () => {
    // Cleanup
    await fs.rm('.ca', { recursive: true, force: true }).catch(() => {
      // Ignore cleanup errors - directory might be in use
    });
    await fs.unlink(testDiffPath).catch(() => {});
    await fs.unlink('/tmp/test-persona.md').catch(() => {});
    vi.restoreAllMocks();
  });

  it('should run complete pipeline successfully', async () => {
    const result = await runPipeline({ diffPath: testDiffPath });

    expect(result.status).toBe('success');
    expect(result.sessionId).toBe('001');
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Verify session directory created
    const sessionDir = `.ca/sessions/${result.date}/${result.sessionId}`;
    const stat = await fs.stat(sessionDir);
    expect(stat.isDirectory()).toBe(true);

    // Verify reviews written
    const reviewsDir = `${sessionDir}/reviews`;
    const reviewFiles = await fs.readdir(reviewsDir);
    expect(reviewFiles.length).toBeGreaterThan(0);

    // Verify report written
    const reportPath = `${sessionDir}/report.md`;
    const reportExists = await fs.stat(reportPath).then(() => true).catch(() => false);
    expect(reportExists).toBe(true);

    // Verify result written
    const resultPath = `${sessionDir}/result.md`;
    const resultExists = await fs.stat(resultPath).then(() => true).catch(() => false);
    expect(resultExists).toBe(true);
  }, 30000);

  it('should handle backend failures gracefully', async () => {
    // Clear previous mocks
    vi.restoreAllMocks();

    // Mock all backends to fail
    vi.spyOn(backend, 'executeBackend').mockRejectedValue(new Error('Backend failed'));

    const result = await runPipeline({ diffPath: testDiffPath });

    // Should fail gracefully when backends fail
    expect(result.status).toBe('error');
    expect(result.error).toBeTruthy();
  });
});
