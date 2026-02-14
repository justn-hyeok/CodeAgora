# Review Cycle 1 - Comprehensive Fix Plan

## Review Summary

**Code Reviewer**: 16 issues (2 CRITICAL, 5 MAJOR, 5 MINOR, 4 SUGGESTION) - **REQUEST CHANGES**
**Architect**: 3 P0 blocking + multiple P1 issues - **REVISE**
**Security Reviewer**: All CRITICAL/HIGH/MEDIUM fixed ✅

---

## Critical Issues (P0) - Must Fix Before Phase 3

### ✅ 1. Temp Directory Cleanup
**Status**: ALREADY FIXED in security review
**Files**: `src/supporter/codex.ts:48`, `src/supporter/gemini.ts:76`
**Verification**: Code shows `await rmdir(tmpDir);` in finally blocks
**Note**: Code reviewer analyzed old code; this is already resolved

### ❌ 2. Debate Engine Mock Responses
**File**: `src/debate/engine.ts:175-181`
**Issue**: Hardcoded mock - never calls actual LLM backends
**Impact**: Entire debate feature is non-functional
**Fix Plan**:
- Import and use `OpenCodeBackend` from `reviewer/adapter.ts`
- Parse debate response for argument, updated severity, confidence
- Update `DebateRound` type to include severity field
- Update `detectConsensus` to use last round's severity

**Implementation**:
```typescript
// Replace mock with actual backend call
const backend = createBackend(reviewer);
const response = await backend.execute(systemPrompt, prompt);
// Parse response for debate-specific fields
const parsed = parseDebateResponse(response);
return {
  argument: parsed.argument,
  confidence: parsed.confidence,
  changedPosition: parsed.changedPosition,
  severity: parsed.severity, // NEW
};
```

### ❌ 3. GitHub Inline Comment File Path Bug
**Files**:
- `src/github/client.ts:189` - Uses `issues[0].line.toString()` as file path
- `src/github/client.ts:177` - Groups by line only, not file:line
- `src/head/synthesizer.ts:3-7` - Root cause: `SynthesizedIssue` missing file field

**Impact**: All inline PR comments will fail or post to wrong locations
**Fix Plan**:
1. Add `file: string` to `SynthesizedIssue` interface
2. Populate file during synthesis from `ParsedReview.file`
3. Update GitHub client grouping key to `${file}:${line}`
4. Use actual file path instead of `line.toString()`

**Implementation**:
```typescript
// synthesizer.ts
export interface SynthesizedIssue extends ReviewIssue {
  file: string; // ADD THIS
  reviewers: string[];
  votes: Record<Severity, number>;
  agreedSeverity: Severity;
}

// In synthesizeReviews(), carry file from grouping
synthesized.push({
  ...baseIssue,
  file: group.file, // ADD THIS
  reviewers: group.reviewers,
  // ...
});

// client.ts - fix grouping
const key = `${issue.file}:${issue.line}`; // CHANGE
const file = issues[0].file; // CHANGE from line.toString()
```

### ❌ 4. GitHub position vs line API Mismatch
**File**: `src/github/client.ts:88`
**Issue**: Using `position` (diff offset) but passing line number
**Fix Plan**: Use `line` and `side` parameters instead of `position`

**Implementation**:
```typescript
// Change from position to line/side
comments: inlineComments.map((c) => ({
  path: c.path,
  line: c.line,        // CHANGE
  side: 'RIGHT',       // ADD
  body: c.body,
})),
```

---

## Major Issues (P1) - Should Fix

### ❌ 5. TypeScript Compiler Errors - supporterResults
**File**: `src/pipeline/index.ts:147`
**Issue**: `let supporterResults = [];` inferred as `any[]`
**Fix**: Add explicit type annotation
```typescript
let supporterResults: SupporterExecutionResult[] = [];
```

### ❌ 6. TypeScript Compiler Errors - debate/engine.ts
**Files**: Lines 10, 136, 168, 252
**Issue**: Unused imports and variables
**Fix**: Remove unused code or implement actual usage
- Line 10: Remove `executeReviewers` import (will use `createBackend` instead)
- Line 136: Remove unused `systemPrompt` variable
- Line 168: Remove unused `prompt` parameter
- Line 252: Remove unused `positions` variable

### ❌ 7. Reference Equality Bug in Debate
**File**: `src/debate/engine.ts:105`
**Issue**: `issues.includes(issue)` uses object reference equality
**Fix**: Use structural comparison with key-based matching
```typescript
const issueKey = (i: ReviewIssue) => `${i.line}:${i.category}:${i.title}`;
const issueKeys = new Set(issues.map(issueKey));
if (!issueKeys.has(issueKey(issue))) continue;
```

### ❌ 8. Supporter Results Not Integrated
**File**: `src/pipeline/index.ts:171`
**Issue**: `synthesizeReviews()` doesn't receive supporter results
**Fix**: Pass supporter results to synthesizer, adjust confidence based on validation
```typescript
const synthesis = synthesizeReviews(successfulReviews, supporterResults);
```

### ❌ 9. Debate Results Not Integrated
**File**: `src/pipeline/index.ts:171`
**Issue**: Debate final severity not reflected in synthesis
**Fix**: Pass debate results to synthesizer, override severity based on consensus
```typescript
const synthesis = synthesizeReviews(successfulReviews, supporterResults, chunkDebateResults);
```

### ❌ 10. Any Types in Codex Supporter
**Files**: `src/supporter/codex.ts:57,84,125,164`
**Issue**: `issue: any` instead of `ReviewIssue`
**Fix**: Change all occurrences to `issue: ReviewIssue`

---

## Minor/Suggestions (P2) - Optional

11. Supporter union type instead of interface (`executor.ts:53`)
12. No concurrency limit on supporter validation (`executor.ts:59`)
13. Hardcoded models in supporters (`gemini.ts:22`, `codex.ts`)
14. Sequential debates (could parallelize)
15. No try/catch around debate in pipeline
16. Logging abstraction instead of direct console
17. Security check uses naive grep
18. loadSystemPrompt in hot loop

---

## Implementation Priority

### Phase 1 - CRITICAL Fixes (Blocking)
1. ✅ Temp cleanup (already done)
2. Fix SynthesizedIssue file property (#3 part 1)
3. Fix GitHub inline comments (#3 parts 2-4)
4. Fix GitHub position API (#4)
5. Implement debate backend calls (#2)
6. Update debate consensus detection (#2)

### Phase 2 - MAJOR Fixes (High Priority)
7. Fix TypeScript errors (#5, #6)
8. Fix reference equality bug (#7)
9. Integrate supporter results (#8)
10. Integrate debate results (#9)
11. Fix any types (#10)

### Phase 3 - MINOR Fixes (Nice to Have)
12-18. Address remaining suggestions

---

## Testing Strategy

After each fix:
1. Run `pnpm build` - verify TypeScript compilation
2. Run `pnpm test` - verify all 207 tests pass
3. Add new tests for fixed behaviors:
   - Test debate actually calls backends
   - Test GitHub inline comments use correct file paths
   - Test synthesis integration with supporters/debates

---

## Success Criteria

- [ ] All CRITICAL issues fixed (P0 #2-4)
- [ ] All MAJOR issues fixed (P1 #5-10)
- [ ] Build passes with 0 TypeScript errors
- [ ] All 207+ tests pass
- [ ] New tests added for fixed behaviors
- [ ] Code reviewer would APPROVE
- [ ] Architect would APPROVE

---

## Next Steps

1. Implement Phase 1 fixes (CRITICAL)
2. Verify with build + tests
3. Implement Phase 2 fixes (MAJOR)
4. Verify with build + tests
5. Run Review Cycle 2 (re-review with fixes)
6. Address any new findings
7. Run Review Cycle 3 (final verification)
8. Proceed to Phase 3

---

## Notes

- Security review findings were already addressed
- Total estimated fixes: 9 critical/major issues
- Code reviewer found temp cleanup issue but it's already fixed
- Architect verdict is REVISE, not REJECT - foundation is solid
