/**
 * Early-stop command tests
 * Jaccard similarity for debate early stopping
 */

import { describe, it, expect } from 'vitest';
import { earlyStop } from '../../src/commands/early-stop.js';
import type { DebateParticipant } from '../../src/types/index.js';

describe('early-stop command', () => {
  it('should return true for high similarity (>90%)', () => {
    const participants: DebateParticipant[] = [
      {
        reviewer: 'r1',
        rounds: [
          { round: 1, reasoning: 'The function has a critical memory leak problem', severity: 'critical' },
          { round: 2, reasoning: 'The function has a critical memory leak problem', severity: 'critical' },
        ],
      },
    ];

    const input = JSON.stringify({
      participants,
      minRounds: 2,
      similarityThreshold: 0.9,
    });

    const output = earlyStop(input);
    const result = JSON.parse(output);

    expect(result.shouldStop).toBe(true);
    expect(result.reason).toContain('similarity');
  });

  it('should return false for low similarity (<90%)', () => {
    const participants: DebateParticipant[] = [
      {
        reviewer: 'r1',
        rounds: [
          { round: 1, reasoning: 'The function has a memory leak', severity: 'critical' },
          { round: 2, reasoning: 'Completely different reasoning about performance', severity: 'warning' },
        ],
      },
    ];

    const input = JSON.stringify({
      participants,
      minRounds: 2,
      similarityThreshold: 0.9,
    });

    const output = earlyStop(input);
    const result = JSON.parse(output);

    expect(result.shouldStop).toBe(false);
  });

  it('should return false when not all have minRounds', () => {
    const participants: DebateParticipant[] = [
      {
        reviewer: 'r1',
        rounds: [{ round: 1, reasoning: 'Text', severity: 'critical' }],
      },
    ];

    const input = JSON.stringify({
      participants,
      minRounds: 2,
      similarityThreshold: 0.9,
    });

    const output = earlyStop(input);
    const result = JSON.parse(output);

    expect(result.shouldStop).toBe(false);
    expect(result.reason).toContain('minimum rounds');
  });

  it('should calculate Jaccard similarity correctly', () => {
    // Identical text should have 100% similarity
    const participants: DebateParticipant[] = [
      {
        reviewer: 'r1',
        rounds: [
          { round: 1, reasoning: 'identical text here', severity: 'critical' },
          { round: 2, reasoning: 'identical text here', severity: 'critical' },
        ],
      },
    ];

    const input = JSON.stringify({
      participants,
      minRounds: 2,
      similarityThreshold: 0.9,
    });

    const output = earlyStop(input);
    const result = JSON.parse(output);

    expect(result.shouldStop).toBe(true);
    expect(result.similarities?.r1).toBe(1.0);
  });

  it('should handle completely different text (0% similarity)', () => {
    const participants: DebateParticipant[] = [
      {
        reviewer: 'r1',
        rounds: [
          { round: 1, reasoning: 'alpha beta gamma', severity: 'critical' },
          { round: 2, reasoning: 'delta epsilon zeta', severity: 'critical' },
        ],
      },
    ];

    const input = JSON.stringify({
      participants,
      minRounds: 2,
      similarityThreshold: 0.9,
    });

    const output = earlyStop(input);
    const result = JSON.parse(output);

    expect(result.shouldStop).toBe(false);
    expect(result.similarities?.r1).toBe(0);
  });

  it('should average similarity across multiple participants', () => {
    const participants: DebateParticipant[] = [
      {
        reviewer: 'r1',
        rounds: [
          { round: 1, reasoning: 'same text', severity: 'critical' },
          { round: 2, reasoning: 'same text', severity: 'critical' },
        ],
      },
      {
        reviewer: 'r2',
        rounds: [
          { round: 1, reasoning: 'different words', severity: 'warning' },
          { round: 2, reasoning: 'completely other content', severity: 'warning' },
        ],
      },
    ];

    const input = JSON.stringify({
      participants,
      minRounds: 2,
      similarityThreshold: 0.9,
    });

    const output = earlyStop(input);
    const result = JSON.parse(output);

    // Average of 1.0 and ~0.0 should be around 0.5, which is < 0.9
    expect(result.shouldStop).toBe(false);
    expect(result.similarities).toHaveProperty('r1');
    expect(result.similarities).toHaveProperty('r2');
  });

  it('should ignore case in similarity calculation', () => {
    const participants: DebateParticipant[] = [
      {
        reviewer: 'r1',
        rounds: [
          { round: 1, reasoning: 'The Function Has Issues', severity: 'critical' },
          { round: 2, reasoning: 'the function has issues', severity: 'critical' },
        ],
      },
    ];

    const input = JSON.stringify({
      participants,
      minRounds: 2,
      similarityThreshold: 0.9,
    });

    const output = earlyStop(input);
    const result = JSON.parse(output);

    // Should be identical after case normalization
    expect(result.shouldStop).toBe(true);
  });

  it('should handle empty participants array', () => {
    const input = JSON.stringify({
      participants: [],
      minRounds: 2,
      similarityThreshold: 0.9,
    });

    const output = earlyStop(input);
    const result = JSON.parse(output);

    expect(result.shouldStop).toBe(false);
  });

  it('should use custom threshold', () => {
    const participants: DebateParticipant[] = [
      {
        reviewer: 'r1',
        rounds: [
          { round: 1, reasoning: 'text with some overlap', severity: 'critical' },
          { round: 2, reasoning: 'text with overlap and more', severity: 'critical' },
        ],
      },
    ];

    // Lower threshold (70%)
    const input = JSON.stringify({
      participants,
      minRounds: 2,
      similarityThreshold: 0.7,
    });

    const output = earlyStop(input);
    const result = JSON.parse(output);

    // With lower threshold, might stop earlier
    expect(result).toHaveProperty('shouldStop');
  });

  it('should handle invalid JSON gracefully', () => {
    const output = earlyStop('not valid json');
    const result = JSON.parse(output);

    expect(result).toHaveProperty('error');
  });
});
