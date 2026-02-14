import type { ReviewIssue } from '../parser/schema.js';

export interface DebateParticipant {
  reviewer: string;
  position: ReviewIssue;
  rounds: DebateRound[];
}

export interface DebateRound {
  roundNumber: number;
  argument: string;
  confidence: number;
  changedPosition: boolean;
  severity: string;
  qualityScore?: number; // Quality score based on reasoning depth (0.0-1.0)
}

export interface DebateResult {
  issue: {
    file: string;
    line: number;
    category: string;
  };
  participants: DebateParticipant[];
  rounds: number;
  consensus: ConsensusType;
  finalSeverity: string;
  duration: number;
}

export type ConsensusType = 'strong' | 'majority' | 'failed';

export interface DebateContext {
  issue: ReviewIssue;
  opponentOpinions: Array<{
    reviewer: string;
    position: ReviewIssue;
    argument?: string;
  }>;
  roundNumber: number;
  previousArguments: string[];
}

export interface DebateConfig {
  maxRounds: number;
  strongConsensusThreshold: number; // e.g., 0.8 = 80% agreement
  majorityThreshold: number; // e.g., 0.6 = 60% agreement
}
