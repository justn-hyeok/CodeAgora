/**
 * Score command tests
 * Trajectory Scoring - 5 regex patterns
 */

import { describe, it, expect } from 'vitest';
import { score, scoreReasoning } from '../../src/commands/score.js';

describe('scoreReasoning', () => {
  it('should return base score 0.5 for empty text', () => {
    const result = scoreReasoning('');
    expect(result.score).toBe(0.5);
    expect(result.breakdown).toEqual({
      codeReference: false,
      technicalDepth: false,
      evidenceBased: false,
      specificExamples: false,
      codeSnippets: false,
    });
  });

  it('should detect codeReference pattern (+0.1)', () => {
    const testCases = [
      'The issue is on line 42',
      'The function getName is problematic',
      'Variable userInput needs validation',
      'Method processData has a bug',
    ];

    for (const text of testCases) {
      const result = scoreReasoning(text);
      expect(result.score).toBe(0.6);
      expect(result.breakdown.codeReference).toBe(true);
    }
  });

  it('should detect technicalDepth pattern (+0.1)', () => {
    const testCases = [
      'This causes a memory leak',
      'Performance will degrade',
      'Security vulnerability detected',
      'Thread safety issue',
      'Race condition possible',
      'Deadlock can occur',
    ];

    for (const text of testCases) {
      const result = scoreReasoning(text);
      expect(result.score).toBe(0.6);
      expect(result.breakdown.technicalDepth).toBe(true);
    }
  });

  it('should detect evidenceBased pattern (+0.1)', () => {
    const testCases = [
      'This fails because the input is not validated',
      'The async code needs await since promises are involved',
      'Given that the array can be empty, check length first',
      'Due to the null check missing, this crashes',
      'As a result of the missing validation step',
    ];

    for (const text of testCases) {
      const result = scoreReasoning(text);
      expect(result.score).toBe(0.6);
      expect(result.breakdown.evidenceBased).toBe(true);
    }
  });

  it('should detect specificExamples pattern (+0.1)', () => {
    const testCases = [
      'Specifically, when input is null',
      'Exactly at this point in execution',
      'For example, if user is undefined',
      'Such as empty arrays',
      'This will cause a crash',
    ];

    for (const text of testCases) {
      const result = scoreReasoning(text);
      expect(result.score).toBe(0.6);
      expect(result.breakdown.specificExamples).toBe(true);
    }
  });

  it('should detect codeSnippets pattern (+0.1)', () => {
    const testCases = [
      'Use `async/await` instead',
      'Change to `const x = 1`',
      '```typescript\nconst x = 1\n```',
      'The code: ```\nfoo()\n```',
    ];

    for (const text of testCases) {
      const result = scoreReasoning(text);
      expect(result.score).toBe(0.6);
      expect(result.breakdown.codeSnippets).toBe(true);
    }
  });

  it('should combine multiple patterns correctly', () => {
    const text = `
      The function processUser on line 42 has a memory leak.
      Because the closure retains a reference, the object is never freed.
      Specifically, when processing large arrays, this will cause the heap to grow.
      Use \`WeakMap\` instead of \`Map\`.
    `;

    const result = scoreReasoning(text);

    // All 5 patterns present
    expect(result.breakdown.codeReference).toBe(true); // "line 42", "function processUser"
    expect(result.breakdown.technicalDepth).toBe(true); // "memory leak"
    expect(result.breakdown.evidenceBased).toBe(true); // "Because"
    expect(result.breakdown.specificExamples).toBe(true); // "Specifically", "this will cause"
    expect(result.breakdown.codeSnippets).toBe(true); // `WeakMap`, `Map`

    expect(result.score).toBeCloseTo(1.0, 1); // 0.5 + 0.1*5 = 1.0 (max)
  });

  it('should cap score at 1.0', () => {
    // Even with all patterns, score should not exceed 1.0
    const text = `
      line 1 function foo variable bar method baz
      memory leak performance security thread race condition deadlock
      because since given that due to as a result
      specifically exactly for example such as this will cause
      \`code\` \`\`\`more code\`\`\`
    `;

    const result = scoreReasoning(text);
    expect(result.score).toBeCloseTo(1.0, 1);
  });

  it('should handle partial pattern matches', () => {
    const text = 'The function has issues because of bad design';

    const result = scoreReasoning(text);

    // Should match: codeReference ("function"), evidenceBased ("because")
    expect(result.breakdown.codeReference).toBe(true);
    expect(result.breakdown.evidenceBased).toBe(true);
    expect(result.score).toBeCloseTo(0.7, 1); // 0.5 + 0.1 + 0.1
  });

  it('should be case-insensitive', () => {
    const testCases = [
      'LINE 42 has issues',
      'BECAUSE the validation fails',
      'MEMORY leak detected',
    ];

    for (const text of testCases) {
      const result = scoreReasoning(text);
      expect(result.score).toBeGreaterThan(0.5);
    }
  });
});

describe('score command', () => {
  it('should accept JSON input and return JSON output', () => {
    const input = JSON.stringify({
      reasoning: 'The function on line 42 has a memory leak',
    });

    const output = score(input);
    const result = JSON.parse(output);

    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('breakdown');
    expect(typeof result.score).toBe('number');
  });

  it('should handle invalid JSON gracefully', () => {
    const output = score('not valid json');
    const result = JSON.parse(output);

    expect(result).toHaveProperty('error');
  });

  it('should validate input schema', () => {
    const input = JSON.stringify({
      // Missing 'reasoning' field
      wrong_field: 'test',
    });

    const output = score(input);
    const result = JSON.parse(output);

    expect(result).toHaveProperty('error');
  });
});
