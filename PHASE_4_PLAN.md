# Phase 4 Implementation Plan: Optimization + Extensions

## Overview
Add feedback-based improvements, custom rules, and advanced features based on accumulated review data.

**Duration**: Ralph Loop iterations 21-30 (estimated)
**Review Cycles**: Minimum 3 cycles after implementation

---

## Phase 4 Scope (MVP)

Based on the original plan, Phase 4 is an open-ended optimization phase. For the MVP Ralph loop completion, we'll focus on:

### 4.1: Feedback Collection & Storage
**Goal**: Store review results for future analysis

**Features**:
- JSON file storage for review history
- Track reviewer performance (accuracy, speed)
- Store issue categories and severity distribution
- Simple SQLite schema for structured queries

**Implementation**:
- `src/storage/` module
- `ReviewHistory` type and storage interface
- Pipeline integration (save after each review)

### 4.2: Review Statistics Dashboard
**Goal**: Visualize review metrics

**Features**:
- CLI command: `oh-my-codereview stats`
- Show reviewer accuracy over time
- Most common issue categories
- Average review time per file
- Terminal-based charts (using ASCII art or blessed)

**Implementation**:
- `src/stats/` module
- `generateStats()` function
- CLI integration

### 4.3: Configuration Validation Enhancement
**Goal**: Better error messages and config validation

**Features**:
- Validate OpenCode provider/model combinations
- Check for required environment variables
- Suggest fixes for common misconfigurations
- Config health check command

**Implementation**:
- Enhance `src/config/loader.ts`
- Add `validateEnvironment()` function
- CLI command: `oh-my-codereview check`

---

## Deferred to Future (Post-MVP)

The following Phase 4 features are valuable but not critical for MVP:

### 4.4: Feedback-Based Agent Weighting (Deferred)
- Adjust reviewer confidence weights based on historical accuracy
- Requires significant review history data
- Complex scoring algorithm

### 4.5: PR-Specific Reviewer Selection (Deferred)
- Auto-select reviewers based on file types
- Language-specific reviewer routing
- Requires training data

### 4.6: Custom Review Rules (Deferred)
- Project-specific rule engine
- FSD architecture validation
- Custom severity mappings

### 4.7: Review Dashboard (Deferred)
- Web UI for review history
- Requires web framework (Next.js)
- Out of scope for CLI tool

### 4.8: Security Preprocessing (Deferred)
- Pre-scan for secrets before review
- Already handled by supporters (Codex)

### 4.9: Prompt Auto-Improvement (Deferred)
- A/B testing framework
- Requires multiple review iterations

---

## Phase 4 MVP Implementation

### Task 1: Storage Module (Review History)

**File**: `src/storage/history.ts`

```typescript
export interface ReviewHistoryEntry {
  id: string;
  timestamp: number;
  file: string;
  reviewers: string[];
  issues: number;
  severities: Record<Severity, number>;
  duration: number;
  debateOccurred: boolean;
  supporterValidations: number;
}

export class ReviewHistoryStorage {
  async save(entry: ReviewHistoryEntry): Promise<void>;
  async load(): Promise<ReviewHistoryEntry[]>;
  async getStats(): Promise<ReviewStats>;
}
```

**Implementation**:
- JSON file storage in `~/.oh-my-codereview/history.json`
- Append-only writes
- Max 1000 entries (rotate old ones)

### Task 2: Statistics Module

**File**: `src/stats/generator.ts`

```typescript
export interface ReviewStats {
  totalReviews: number;
  totalIssues: number;
  averageDuration: number;
  issuesByCategory: Record<string, number>;
  issuesBySeverity: Record<Severity, number>;
  reviewerStats: Record<string, {
    reviews: number;
    averageIssues: number;
    averageDuration: number;
  }>;
}

export function generateStats(history: ReviewHistoryEntry[]): ReviewStats;
export function formatStatsReport(stats: ReviewStats): string;
```

**CLI Integration**:
- `oh-my-codereview stats` - show all-time stats
- `oh-my-codereview stats --last 10` - show last N reviews
- `oh-my-codereview stats --reviewer <name>` - reviewer-specific stats

### Task 3: Config Health Check

**File**: `src/config/validator.ts`

```typescript
export interface ConfigHealthCheck {
  valid: boolean;
  warnings: string[];
  errors: string[];
  suggestions: string[];
}

export function checkConfigHealth(config: Config): ConfigHealthCheck;
export function checkEnvironment(): {
  opencodeInstalled: boolean;
  providersConfigured: string[];
  missingKeys: string[];
};
```

**CLI Integration**:
- `oh-my-codereview check` - validate config and environment
- Exit code 0 if healthy, 1 if errors

---

## Implementation Order

### Step 1: Storage Module (1 hour)
- Create `src/storage/history.ts`
- Implement JSON file storage
- Add history entry saving to pipeline
- Test with sample data

### Step 2: Statistics Generator (1 hour)
- Create `src/stats/generator.ts`
- Implement stats calculation
- Format stats as terminal output
- Add CLI command

### Step 3: Config Health Check (45 min)
- Enhance `src/config/loader.ts`
- Add environment validation
- Check OpenCode installation
- Add CLI command

### Step 4: Testing (1 hour)
- Write storage tests
- Write stats calculation tests
- Write config validation tests
- Integration test

### Step 5: Documentation (30 min)
- Update README with new commands
- Document storage location
- Add stats examples

**Total Estimated Time**: 4 hours

---

## File Structure

```
src/
├── storage/
│   ├── history.ts      # Review history storage
│   └── types.ts        # Storage types
├── stats/
│   ├── generator.ts    # Stats calculation
│   └── formatter.ts    # Terminal formatting
├── config/
│   └── validator.ts    # Config health checks (new)
└── cli/
    └── index.ts        # Add stats & check commands

tests/
├── storage/
│   └── history.test.ts
└── stats/
    └── generator.test.ts
```

---

## Success Criteria

- [ ] Review history saved after each review
- [ ] `oh-my-codereview stats` displays metrics
- [ ] `oh-my-codereview check` validates config
- [ ] Storage rotates after 1000 entries
- [ ] Tests: 100% passing
- [ ] TypeScript: 0 errors
- [ ] Build: Clean
- [ ] Review Cycle 1: Complete
- [ ] Review Cycle 2: Complete
- [ ] Review Cycle 3: APPROVE

---

## Dependencies

No new runtime dependencies needed:
- Storage: Use Node.js `fs/promises`
- Stats: Pure TypeScript calculation
- CLI: Existing `commander` framework

---

## Risk Mitigation

1. **File system errors**: Catch and log, don't crash pipeline
2. **Large history files**: Implement rotation (max 1000 entries)
3. **Concurrent writes**: Use atomic write pattern (tmp file + rename)
4. **Storage format changes**: Version the JSON schema

---

## Next Steps After Phase 4

1. Run minimum 3 review cycles on Phase 4 code
2. Fix any issues found by reviewers
3. Achieve APPROVE verdicts
4. **Exit Ralph loop** - All planned MVP phases complete
5. Document project completion

---

**Ready to begin implementation**: Step 1 - Storage Module
