import type { ParsedReview, ReviewIssue } from '../parser/schema.js';
import type { Reviewer } from '../config/schema.js';
import type {
  DebateParticipant,
  DebateResult,
  DebateContext,
  DebateConfig,
  ConsensusType,
} from './types.js';
import { OpenCodeBackend } from '../reviewer/adapter.js';

const DEFAULT_CONFIG: DebateConfig = {
  maxRounds: 3,
  strongConsensusThreshold: 0.8,
  majorityThreshold: 0.6,
};

/**
 * Score the quality of reasoning based on technical depth and specificity
 * Higher scores indicate better-supported arguments
 */
export function scoreReasoning(reasoning: string): number {
  let score = 0.5; // Base score

  // Code-specific references (line numbers, function names, variables)
  if (/line\s+\d+|function\s+\w+|variable\s+\w+|method\s+\w+/i.test(reasoning)) {
    score += 0.1;
  }

  // Technical depth (memory, performance, security, concurrency, etc.)
  if (/memory|performance|security|thread|race\s+condition|deadlock|leak/i.test(reasoning)) {
    score += 0.1;
  }

  // Evidence-based reasoning (because, since, given that, etc.)
  if (/because|since|given\s+that|due\s+to|as\s+a\s+result/i.test(reasoning)) {
    score += 0.1;
  }

  // Specific examples or concrete consequences
  if (/specifically|exactly|for\s+example|such\s+as|this\s+will\s+cause/i.test(reasoning)) {
    score += 0.1;
  }

  // Code snippets or direct quotes
  if (/`[^`]+`|```/.test(reasoning)) {
    score += 0.1;
  }

  return Math.min(score, 1.0);
}

/**
 * Calculate similarity between two strings using simple word overlap
 * Returns value between 0 and 1 (1 = identical)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Check if debate should stop early (no new insights)
 * Returns true if all participants maintained same position with similar reasoning
 */
function checkEarlyStopping(participants: DebateParticipant[]): boolean {
  // Need at least 2 rounds to compare
  if (participants.some((p) => p.rounds.length < 2)) {
    return false;
  }

  // Check if all participants maintained same position with similar reasoning
  for (const p of participants) {
    const lastRound = p.rounds[p.rounds.length - 1];
    const prevRound = p.rounds[p.rounds.length - 2];

    // Different severity? Continue debate
    if (lastRound.severity !== prevRound.severity) {
      return false;
    }

    // Calculate reasoning similarity
    const similarity = calculateSimilarity(lastRound.argument, prevRound.argument);

    // If reasoning changed significantly (< 90% similar), continue
    if (similarity < 0.9) {
      return false;
    }
  }

  // All participants unchanged → early stop
  return true;
}

/**
 * Conducts a debate between reviewers who have conflicting opinions
 */
export async function conductDebate(
  issues: ReviewIssue[],
  reviews: ParsedReview[],
  reviewers: Reviewer[],
  config: DebateConfig = DEFAULT_CONFIG
): Promise<DebateResult[]> {
  const results: DebateResult[] = [];

  // Group issues by location (file:line:category)
  const issueGroups = groupIssuesByLocation(issues, reviews);

  for (const [location, group] of issueGroups.entries()) {
    const startTime = Date.now();

    const participants: DebateParticipant[] = group.participants.map((p) => ({
      reviewer: p.reviewer,
      position: p.issue,
      rounds: [],
    }));

    let currentRound = 1;
    let consensusReached = false;
    let earlyStop = false;

    while (currentRound <= config.maxRounds && !consensusReached && !earlyStop) {
      console.log(`  Round ${currentRound}/${config.maxRounds} for ${location}`);

      // Execute debate round
      await executeDebateRound(
        participants,
        reviewers,
        currentRound,
        group.file,
        group.line,
        group.category
      );

      // Check for consensus
      const consensus = detectConsensus(participants, config);
      if (consensus.reached) {
        consensusReached = true;
        console.log(`  Consensus reached: ${consensus.type}`);
      }

      // Check for early stopping (after round 2+)
      if (currentRound >= 2 && !consensusReached) {
        if (checkEarlyStopping(participants)) {
          earlyStop = true;
          console.log(`  Early stopping: No new insights (round ${currentRound})`);
        }
      }

      currentRound++;
    }

    const finalConsensus = detectConsensus(participants, config);

    results.push({
      issue: {
        file: group.file,
        line: group.line,
        category: group.category,
      },
      participants,
      rounds: currentRound - 1,
      consensus: finalConsensus.type,
      finalSeverity: finalConsensus.severity,
      duration: Date.now() - startTime,
    });
  }

  return results;
}

interface IssueGroup {
  file: string;
  line: number;
  category: string;
  participants: Array<{
    reviewer: string;
    issue: ReviewIssue;
  }>;
}

function groupIssuesByLocation(
  issues: ReviewIssue[],
  reviews: ParsedReview[]
): Map<string, IssueGroup> {
  const groups = new Map<string, IssueGroup>();

  // Create a Set of issue keys for O(1) lookup instead of reference equality
  const issueKey = (i: ReviewIssue) => `${i.line}:${i.category}:${i.title}`;
  const issueKeys = new Set(issues.map(issueKey));

  for (const review of reviews) {
    for (const issue of review.issues) {
      if (!issueKeys.has(issueKey(issue))) continue;

      const key = `${review.file}:${issue.line}:${issue.category}`;

      if (!groups.has(key)) {
        groups.set(key, {
          file: review.file,
          line: issue.line,
          category: issue.category,
          participants: [],
        });
      }

      groups.get(key)!.participants.push({
        reviewer: review.reviewer,
        issue,
      });
    }
  }

  return groups;
}

/**
 * Parse debate response to extract argument, confidence, position change, and severity
 */
function parseDebateResponse(
  response: string,
  originalPosition: ReviewIssue
): {
  argument: string;
  confidence: number;
  changedPosition: boolean;
  severity: string;
} {
  const lines = response.trim().split('\n');
  let argument = '';
  let confidence = originalPosition.confidence;
  let severity = originalPosition.severity;
  let changedPosition = false;

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Extract confidence
    if (lower.includes('confidence:')) {
      const match = line.match(/confidence:\s*([\d.]+)/i);
      if (match) {
        const parsed = parseFloat(match[1]);
        if (parsed >= 0 && parsed <= 1) {
          confidence = parsed;
        } else if (parsed > 1 && parsed <= 100) {
          confidence = parsed / 100;
        }
      }
    }

    // Extract severity
    if (lower.includes('severity:')) {
      const match = line.match(/severity:\s*(critical|major|minor|suggestion)/i);
      if (match) {
        severity = match[1].toUpperCase() as 'CRITICAL' | 'MAJOR' | 'MINOR' | 'SUGGESTION';
        if (severity !== originalPosition.severity) {
          changedPosition = true;
        }
      }
    }

    // Extract position change
    if (lower.includes('position:') || lower.includes('changed position:')) {
      if (lower.includes('changed') || lower.includes('yes') || lower.includes('true')) {
        changedPosition = true;
      }
    }

    // Collect argument (everything that's not metadata)
    if (!lower.includes('confidence:') && !lower.includes('severity:') && !lower.includes('position:')) {
      argument += line + '\n';
    }
  }

  return {
    argument: argument.trim() || response.slice(0, 200), // Fallback to first 200 chars
    confidence,
    changedPosition,
    severity,
  };
}

async function executeDebateRound(
  participants: DebateParticipant[],
  reviewers: Reviewer[],
  roundNumber: number,
  file: string,
  line: number,
  category: string
): Promise<void> {
  // Build debate context for each participant
  const debateContexts: Map<string, DebateContext> = new Map();

  for (const participant of participants) {
    const opponents = participants
      .filter((p) => p.reviewer !== participant.reviewer)
      .map((p) => ({
        reviewer: p.reviewer,
        position: p.position,
        argument: p.rounds[roundNumber - 2]?.argument, // Previous round's argument
      }));

    debateContexts.set(participant.reviewer, {
      issue: participant.position,
      opponentOpinions: opponents,
      roundNumber,
      previousArguments: participant.rounds.map((r) => r.argument),
    });
  }

  // Generate debate prompts
  const debatePrompts = participants.map((p) => {
    const context = debateContexts.get(p.reviewer)!;
    return generateDebatePrompt(context, file, line, category);
  });

  // Execute reviewers with debate prompts (parallel)
  const backend = new OpenCodeBackend();

  // Create a minimal chunk for debate context (required by ReviewRequest interface)
  const debateChunk = {
    file,
    lineRange: [line, line] as [number, number],
    content: `Debate context for ${file}:${line} (${category})`,
    language: 'unknown',
  };

  const responses = await Promise.all(
    debatePrompts.map(async (prompt, idx) => {
      const participant = participants[idx];
      const reviewer = reviewers.find((r) => r.name === participant.reviewer);
      if (!reviewer) {
        throw new Error(`Reviewer ${participant.reviewer} not found`);
      }

      try {
        // Call the reviewer backend with debate prompt
        const result = await backend.execute(reviewer, {
          chunk: debateChunk,
          systemPrompt: 'You are participating in a code review debate. Analyze the arguments presented and respond with your position.',
          userPrompt: prompt,
        });

        if (!result.success) {
          // If backend fails, keep original position
          return {
            argument: `Failed to get response: ${result.error}`,
            confidence: participant.position.confidence,
            changedPosition: false,
            severity: participant.position.severity,
          };
        }

        // Parse the debate response
        const parsed = parseDebateResponse(result.response, participant.position);
        return parsed;
      } catch (error) {
        // On error, keep original position
        return {
          argument: `Error: ${error instanceof Error ? error.message : String(error)}`,
          confidence: participant.position.confidence,
          changedPosition: false,
          severity: participant.position.severity,
        };
      }
    })
  );

  // Update participant rounds with quality scores
  participants.forEach((p, idx) => {
    const response = responses[idx];
    p.rounds.push({
      roundNumber,
      argument: response.argument,
      confidence: response.confidence,
      changedPosition: response.changedPosition,
      severity: response.severity,
      qualityScore: scoreReasoning(response.argument),
    });
  });
}

/**
 * Anonymize opponent opinions by grouping them by severity
 * This reduces identity bias and focuses on technical merit
 * @internal Exported for testing
 */
export function anonymizeOpponentOpinions(
  opinions: Array<{
    reviewer: string;
    position: ReviewIssue;
    argument?: string;
  }>
): string {
  // Group opinions by severity
  const groups = new Map<string, Array<{ position: ReviewIssue; argument?: string }>>();

  for (const op of opinions) {
    const severity = op.position.severity;
    if (!groups.has(severity)) {
      groups.set(severity, []);
    }
    groups.get(severity)!.push({
      position: op.position,
      argument: op.argument,
    });
  }

  // Format grouped opinions
  const formattedGroups: string[] = [];

  for (const [severity, items] of groups) {
    const header = `${items.length} reviewer(s) identified as ${severity}:`;
    const details = items
      .map((item, idx) => {
        let detail = `  ${idx + 1}. "${item.position.title}"`;
        if (item.position.description) {
          detail += `\n     ${item.position.description}`;
        }
        if (item.argument) {
          detail += `\n     Previous argument: ${item.argument}`;
        }
        return detail;
      })
      .join('\n');

    formattedGroups.push(`${header}\n${details}`);
  }

  return formattedGroups.join('\n\n');
}

/**
 * Generate round-specific instructions to prevent conformity bias
 * Based on Free-MAD research: explicit anti-conformity language in later rounds
 * @internal Exported for testing
 */
export function getRoundInstruction(roundNumber: number): string {
  if (roundNumber === 1) {
    return `State your independent technical analysis based on the code evidence.
Do not be influenced by the number of reviewers holding a position.
Focus solely on technical correctness and code quality.`;
  }

  if (roundNumber === 2) {
    return `IMPORTANT: You are NOT required to change your position to match the majority.

Review the opponent arguments critically:
- If you change your position, you MUST provide specific technical justification
- If you maintain your position, explain what evidence would change your mind
- Evaluate arguments based on technical merit, NOT on how many reviewers agree

Quality over consensus: A single well-supported argument can outweigh multiple weak ones.`;
  }

  // Round 3+
  return `Final technical assessment:

Summarize:
1. Your final position and confidence level
2. Key technical evidence supporting your conclusion
3. Any remaining uncertainties or edge cases

This is the final round. Make your strongest technical case.`;
}

function generateDebatePrompt(
  context: DebateContext,
  file: string,
  line: number,
  category: string
): string {
  const opponentSummary = anonymizeOpponentOpinions(context.opponentOpinions);

  const previousArgs = context.previousArguments.length
    ? `\n\nYour previous arguments:\n${context.previousArguments.map((arg, i) => `Round ${i + 1}: ${arg}`).join('\n')}`
    : '';

  const roundInstruction = getRoundInstruction(context.roundNumber);

  return `# Code Review Debate - Round ${context.roundNumber}

You are participating in a debate about an issue at ${file}:${line} (${category}).

## Your Position
- Severity: ${context.issue.severity}
- Title: ${context.issue.title}
- Description: ${context.issue.description}
- Confidence: ${context.issue.confidence}

## Anonymous Opponent Positions
${opponentSummary}

${previousArgs}

## Task
${roundInstruction}

IMPORTANT: Focus on technical merit, not reviewer identity. Evaluate arguments based on:
- Code-specific evidence
- Technical depth and consequences
- Concrete examples

Provide:
- Your updated severity (CRITICAL/MAJOR/MINOR/SUGGESTION)
- Your updated confidence (0.0-1.0)
- Your argument (explain your reasoning, reference code evidence)
- Whether you changed your position (yes/no)

Keep your response focused and evidence-based.`;
}

function detectConsensus(
  participants: DebateParticipant[],
  config: DebateConfig
): { reached: boolean; type: ConsensusType; severity: string } {
  if (participants.length === 0) {
    return { reached: false, type: 'failed', severity: 'MINOR' };
  }

  // Get current positions from last round or initial position
  const severities = participants.map((p) => {
    const lastRound = p.rounds[p.rounds.length - 1];
    return lastRound?.severity ?? p.position.severity;
  });

  // Count severity votes
  const severityVotes = new Map<string, number>();
  severities.forEach((s) => {
    severityVotes.set(s, (severityVotes.get(s) || 0) + 1);
  });

  const maxVotes = Math.max(...severityVotes.values());
  const winnerSeverity =
    [...severityVotes.entries()].find(([_, votes]) => votes === maxVotes)?.[0] || 'MINOR';

  const agreement = maxVotes / participants.length;

  if (agreement >= config.strongConsensusThreshold) {
    return { reached: true, type: 'strong', severity: winnerSeverity };
  }

  if (agreement >= config.majorityThreshold) {
    return { reached: true, type: 'majority', severity: winnerSeverity };
  }

  return { reached: false, type: 'failed', severity: winnerSeverity };
}
