/**
 * early-stop command
 * Check if debate should stop early based on reasoning similarity
 */

import type { EarlyStopOutput, DebateParticipant } from '../types/index.js';
import { EarlyStopInputSchema } from '../types/index.js';

/**
 * Calculate Jaccard similarity between two texts (word-level)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(
    str1
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0)
  );
  const words2 = new Set(
    str2
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0)
  );

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 0;

  return intersection.size / union.size;
}

export function checkEarlyStopping(
  participants: DebateParticipant[],
  minRounds: number,
  similarityThreshold: number
): EarlyStopOutput {
  // Check if all participants have completed minimum rounds
  const allHaveMinRounds = participants.every((p) => p.rounds.length >= minRounds);

  if (!allHaveMinRounds) {
    return {
      shouldStop: false,
      reason: 'Not all participants have completed minimum rounds',
    };
  }

  // Check similarity between last two rounds for each participant
  const similarities: Record<string, number> = {};
  let totalSimilarity = 0;
  let count = 0;

  for (const participant of participants) {
    if (participant.rounds.length < 2) continue;

    const lastRound = participant.rounds[participant.rounds.length - 1];
    const prevRound = participant.rounds[participant.rounds.length - 2];

    const similarity = calculateSimilarity(lastRound.reasoning, prevRound.reasoning);
    similarities[participant.reviewer] = similarity;
    totalSimilarity += similarity;
    count++;
  }

  if (count === 0) {
    return {
      shouldStop: false,
      reason: 'No participants with multiple rounds',
    };
  }

  const avgSimilarity = totalSimilarity / count;

  if (avgSimilarity >= similarityThreshold) {
    return {
      shouldStop: true,
      reason: `Average similarity ${(avgSimilarity * 100).toFixed(1)}% >= ${(similarityThreshold * 100).toFixed(1)}% threshold`,
      similarities,
    };
  }

  return {
    shouldStop: false,
    reason: `Average similarity ${(avgSimilarity * 100).toFixed(1)}% < ${(similarityThreshold * 100).toFixed(1)}% threshold`,
    similarities,
  };
}

export function earlyStop(inputJson: string): string {
  try {
    const input = JSON.parse(inputJson) as unknown;
    const validated = EarlyStopInputSchema.parse(input);
    const participants = validated.participants as DebateParticipant[];

    const output = checkEarlyStopping(
      participants,
      validated.minRounds,
      validated.similarityThreshold
    );

    return JSON.stringify(output, null, 2);
  } catch (error) {
    return JSON.stringify(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    );
  }
}
