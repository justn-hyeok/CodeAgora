/**
 * L2 Moderator - Discussion Orchestration
 * Manages discussion lifecycle, coordinates supporters, writes final report
 */

import type { Discussion, DiscussionRound, DiscussionVerdict, ModeratorReport, EvidenceDocument } from '../types/core.js';
import type { ModeratorConfig, SupporterConfig, DiscussionSettings } from '../types/config.js';
import { executeBackend } from '../l1/backend.js';
import { writeDiscussionRound, writeDiscussionVerdict } from './writer.js';

// ============================================================================
// Moderator Orchestration
// ============================================================================

export interface ModeratorInput {
  config: ModeratorConfig;
  supporterConfigs: SupporterConfig[];
  discussions: Discussion[];
  settings: DiscussionSettings;
  date: string;
  sessionId: string;
}

/**
 * Run all discussions and generate final report
 */
export async function runModerator(input: ModeratorInput): Promise<ModeratorReport> {
  const { config, supporterConfigs, discussions, settings, date, sessionId } = input;

  const verdicts: DiscussionVerdict[] = [];

  for (const discussion of discussions) {
    const verdict = await runDiscussion(
      discussion,
      config,
      supporterConfigs,
      settings,
      date,
      sessionId
    );
    verdicts.push(verdict);
  }

  return {
    discussions: verdicts,
    unconfirmedIssues: [], // Populated by caller
    suggestions: [], // Populated by caller
    summary: {
      totalDiscussions: discussions.length,
      resolved: verdicts.filter((v) => v.consensusReached).length,
      escalated: verdicts.filter((v) => !v.consensusReached).length,
    },
  };
}

// ============================================================================
// Discussion Execution
// ============================================================================

async function runDiscussion(
  discussion: Discussion,
  moderatorConfig: ModeratorConfig,
  supporterConfigs: SupporterConfig[],
  settings: DiscussionSettings,
  date: string,
  sessionId: string
): Promise<DiscussionVerdict> {
  const rounds: DiscussionRound[] = [];

  // HARSHLY_CRITICAL: Skip discussion, escalate immediately
  if (discussion.severity === 'HARSHLY_CRITICAL') {
    const verdict: DiscussionVerdict = {
      discussionId: discussion.id,
      finalSeverity: 'HARSHLY_CRITICAL',
      reasoning: 'HARSHLY_CRITICAL issues are escalated to Head without discussion',
      consensusReached: false, // Escalated
      rounds: 0,
    };

    // Write verdict file
    await writeDiscussionVerdict(date, sessionId, verdict);

    return verdict;
  }

  // Run up to maxRounds
  for (let roundNum = 1; roundNum <= settings.maxRounds; roundNum++) {
    const round = await runRound(
      discussion,
      roundNum,
      moderatorConfig,
      supporterConfigs
    );

    rounds.push(round);

    // Write round file
    await writeDiscussionRound(date, sessionId, discussion.id, round);

    // Check for consensus
    const consensus = checkConsensus(round);
    if (consensus.reached) {
      const verdict: DiscussionVerdict = {
        discussionId: discussion.id,
        finalSeverity: consensus.severity!,
        reasoning: consensus.reasoning!,
        consensusReached: true,
        rounds: roundNum,
      };

      // Write verdict file
      await writeDiscussionVerdict(date, sessionId, verdict);

      return verdict;
    }
  }

  // Max rounds reached, moderator forces decision
  const finalVerdict = await moderatorForcedDecision(
    discussion,
    rounds,
    moderatorConfig
  );

  const verdict: DiscussionVerdict = {
    discussionId: discussion.id,
    finalSeverity: finalVerdict.severity,
    reasoning: finalVerdict.reasoning,
    consensusReached: false,
    rounds: settings.maxRounds,
  };

  // Write verdict file
  await writeDiscussionVerdict(date, sessionId, verdict);

  return verdict;
}

// ============================================================================
// Round Execution
// ============================================================================

async function runRound(
  discussion: Discussion,
  roundNum: number,
  moderatorConfig: ModeratorConfig,
  supporterConfigs: SupporterConfig[]
): Promise<DiscussionRound> {
  // Moderator prompts the discussion
  const moderatorPrompt = buildModeratorPrompt(discussion, roundNum);

  // Supporters respond in parallel
  const supporterResponses = await Promise.all(
    supporterConfigs.map((config) =>
      executeSupporterResponse(config, discussion, moderatorPrompt)
    )
  );

  return {
    round: roundNum,
    moderatorPrompt,
    supporterResponses,
  };
}

async function executeSupporterResponse(
  config: SupporterConfig,
  discussion: Discussion,
  moderatorPrompt: string
): Promise<{ supporterId: string; response: string; stance: 'agree' | 'disagree' | 'neutral' }> {
  const prompt = `${moderatorPrompt}\n\nAs ${config.role}, provide your verdict:\n- AGREE: Evidence is valid\n- DISAGREE: Evidence is flawed\n- NEUTRAL: Needs more information\n\nProvide your stance and reasoning.`;

  const response = await executeBackend({
    backend: config.backend,
    model: config.model,
    prompt,
    timeout: 120,
  });

  const stance = parseStance(response);

  return {
    supporterId: config.id,
    response,
    stance,
  };
}

// ============================================================================
// Consensus Checking
// ============================================================================

interface ConsensusResult {
  reached: boolean;
  severity?: 'CRITICAL' | 'WARNING' | 'SUGGESTION' | 'DISMISSED';
  reasoning?: string;
}

function checkConsensus(round: DiscussionRound): ConsensusResult {
  const supporters = round.supporterResponses;

  // All agree
  const allAgree = supporters.every((s) => s.stance === 'agree');
  if (allAgree) {
    return {
      reached: true,
      severity: 'CRITICAL', // Placeholder: extract from discussion
      reasoning: 'All supporters agreed on the issue',
    };
  }

  // All disagree
  const allDisagree = supporters.every((s) => s.stance === 'disagree');
  if (allDisagree) {
    return {
      reached: true,
      severity: 'DISMISSED',
      reasoning: 'All supporters rejected the issue',
    };
  }

  return { reached: false };
}

// ============================================================================
// Moderator Forced Decision
// ============================================================================

async function moderatorForcedDecision(
  discussion: Discussion,
  rounds: DiscussionRound[],
  config: ModeratorConfig
): Promise<{ severity: 'CRITICAL' | 'WARNING' | 'SUGGESTION' | 'DISMISSED'; reasoning: string }> {
  const prompt = `You are the moderator. The discussion has reached max rounds without consensus.

Issue: ${discussion.issueTitle}
Severity claimed: ${discussion.severity}

Review all rounds and make a final decision:
- Severity (CRITICAL, WARNING, SUGGESTION, or DISMISSED)
- Reasoning

Rounds:
${rounds.map((r, i) => `Round ${i + 1}:\n${r.supporterResponses.map(s => `- ${s.supporterId}: ${s.stance}`).join('\n')}`).join('\n\n')}
`;

  const response = await executeBackend({
    backend: config.backend,
    model: config.model,
    prompt,
    timeout: 120,
  });

  return parseForcedDecision(response);
}

// ============================================================================
// Helpers
// ============================================================================

function buildModeratorPrompt(discussion: Discussion, roundNum: number): string {
  return `Round ${roundNum}

Issue: ${discussion.issueTitle}
File: ${discussion.filePath}:${discussion.lineRange[0]}-${discussion.lineRange[1]}
Claimed Severity: ${discussion.severity}

Evidence documents: ${discussion.evidenceDocs.length} reviewer(s)

Code snippet:
\`\`\`
${discussion.codeSnippet}
\`\`\`

Evaluate the evidence and provide your verdict.`;
}

function parseStance(response: string): 'agree' | 'disagree' | 'neutral' {
  const lower = response.toLowerCase();
  if (lower.includes('agree') && !lower.includes('disagree')) return 'agree';
  if (lower.includes('disagree')) return 'disagree';
  return 'neutral';
}

function parseForcedDecision(response: string): { severity: 'CRITICAL' | 'WARNING' | 'SUGGESTION' | 'DISMISSED'; reasoning: string } {
  const lower = response.toLowerCase();

  let severity: 'CRITICAL' | 'WARNING' | 'SUGGESTION' | 'DISMISSED' = 'SUGGESTION';
  if (lower.includes('critical')) severity = 'CRITICAL';
  else if (lower.includes('warning')) severity = 'WARNING';
  else if (lower.includes('dismissed')) severity = 'DISMISSED';

  return {
    severity,
    reasoning: response.trim(),
  };
}
