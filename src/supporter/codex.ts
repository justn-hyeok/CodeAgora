import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdtemp, rmdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import crypto from 'crypto';
import type {
  SupporterBackend,
  SupporterValidationRequest,
  SupporterValidationResult,
} from './types.js';
import type { ReviewIssue } from '../parser/schema.js';

const execFileAsync = promisify(execFile);

export class CodexSupporter implements SupporterBackend {
  name = 'codex';

  async validate(request: SupporterValidationRequest): Promise<SupporterValidationResult> {
    const tmpDir = await mkdtemp(join(tmpdir(), 'omc-codex-'));
    const testFile = join(tmpDir, `test_${crypto.randomUUID()}.ts`);

    try {
      // Write test file
      await writeFile(testFile, request.context, {
        encoding: 'utf-8',
        mode: 0o600,
      });

      // Run validation based on issue category
      const validationResult = await this.runValidation(
        request.issue.category,
        testFile,
        request.issue
      );

      return validationResult;
    } catch (error) {
      return {
        issue: request.issue,
        validated: false,
        evidence: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
        confidence: 0.5,
      };
    } finally {
      // Cleanup - remove file and directory
      try {
        await unlink(testFile);
        await rmdir(tmpDir);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private async runValidation(
    category: string,
    testFile: string,
    issue: ReviewIssue
  ): Promise<SupporterValidationResult> {
    switch (category) {
      case 'type':
      case 'types':
        return this.runTypeCheck(testFile, issue);

      case 'lint':
      case 'style':
        return this.runLint(testFile, issue);

      case 'security':
        return this.runSecurityCheck(testFile, issue);

      default:
        // For other categories, return unvalidated
        return {
          issue,
          validated: false,
          evidence: `Category '${category}' not supported by Codex`,
          confidence: 0.5,
        };
    }
  }

  private async runTypeCheck(
    testFile: string,
    issue: ReviewIssue
  ): Promise<SupporterValidationResult> {
    try {
      const { stdout, stderr } = await execFileAsync('tsc', ['--noEmit', testFile], {
        timeout: 10000,
        maxBuffer: 1024 * 1024,
      });

      const output = stdout + stderr;
      const hasError = output.toLowerCase().includes('error');

      return {
        issue,
        validated: hasError,
        evidence: hasError
          ? 'TypeScript compiler confirms type error'
          : 'No type errors found',
        toolOutput: output.slice(0, 500), // Truncate
        confidence: hasError ? 0.95 : 0.7,
      };
    } catch (error) {
      // tsc exits with non-zero on errors
      const stderr =
        error && typeof error === 'object' && 'stderr' in error
          ? String(error.stderr)
          : String(error);

      const hasTypeError = stderr.toLowerCase().includes('error ts');

      return {
        issue,
        validated: hasTypeError,
        evidence: hasTypeError
          ? 'TypeScript compiler confirms type error'
          : 'Type check execution failed',
        toolOutput: stderr.slice(0, 500),
        confidence: hasTypeError ? 0.95 : 0.5,
      };
    }
  }

  private async runLint(testFile: string, issue: ReviewIssue): Promise<SupporterValidationResult> {
    try {
      const { stdout, stderr } = await execFileAsync('eslint', [testFile], {
        timeout: 10000,
        maxBuffer: 1024 * 1024,
      });

      const output = stdout + stderr;
      const hasWarning = output.toLowerCase().includes('warning');
      const hasError = output.toLowerCase().includes('error');

      return {
        issue,
        validated: hasWarning || hasError,
        evidence: hasWarning || hasError ? 'ESLint confirms issue' : 'No lint issues found',
        toolOutput: output.slice(0, 500),
        confidence: hasError ? 0.9 : hasWarning ? 0.8 : 0.6,
      };
    } catch (error) {
      // eslint exits with non-zero on errors
      const stdout =
        error && typeof error === 'object' && 'stdout' in error
          ? String(error.stdout)
          : '';

      const hasIssues = stdout.toLowerCase().includes('problem');

      return {
        issue,
        validated: hasIssues,
        evidence: hasIssues ? 'ESLint confirms issue' : 'Lint check execution failed',
        toolOutput: stdout.slice(0, 500),
        confidence: hasIssues ? 0.85 : 0.5,
      };
    }
  }

  private async runSecurityCheck(
    testFile: string,
    issue: ReviewIssue
  ): Promise<SupporterValidationResult> {
    // Simplified security check - in production, use tools like semgrep
    try {
      const { stdout } = await execFileAsync('grep', ['-n', '-E', 'eval|innerHTML|dangerouslySetInnerHTML', testFile], {
        timeout: 5000,
        maxBuffer: 1024 * 1024,
      });

      const hasSecurityPattern = stdout.trim().length > 0;

      return {
        issue,
        validated: hasSecurityPattern,
        evidence: hasSecurityPattern
          ? 'Security pattern detected in code'
          : 'No obvious security patterns found',
        toolOutput: stdout.slice(0, 500),
        confidence: hasSecurityPattern ? 0.8 : 0.5,
      };
    } catch (error) {
      // grep exits with non-zero if no matches
      return {
        issue,
        validated: false,
        evidence: 'Security check found no obvious patterns',
        confidence: 0.5,
      };
    }
  }
}
