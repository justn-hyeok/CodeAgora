# Migration Guide: V1 → V2

**CodeAgora V1** (TypeScript CLI) → **CodeAgora V2** (Claude Code Skill)

---

## Overview

V2 represents a complete architectural redesign from a standalone TypeScript CLI to a Claude Code skill-based system. This migration improves flexibility, maintainability, and enables heterogeneous LLM backends.

## What Changed

### V1 Architecture (Deprecated)

```
User → codeagora CLI
     → src/pipeline/index.ts (TypeScript orchestration)
     → src/llm/adapter.ts (Single backend: OpenCode only)
     → src/reviewer/executor.ts
     → OpenCode CLI (hardcoded)
     → src/head/synthesizer.ts (TypeScript synthesis)
```

**Limitations:**
- Only supported OpenCode backend
- Hardcoded pipeline logic
- TypeScript compilation errors
- Difficult to add new backends
- No Claude Code integration

### V2 Architecture (Current)

```
User → /agora review (Claude Code skill)
     → .claude/skills/agora-review.md (Bash orchestration)
     → Backend CLIs (Codex, Gemini, OpenCode)
     → tools/dist/index.js (Deterministic helpers)
     → Claude Code synthesis (LLM-powered)
```

**Benefits:**
- ✅ Heterogeneous backends (mix Codex, Gemini, OpenCode)
- ✅ No TypeScript compilation errors
- ✅ Claude Code orchestration + synthesis
- ✅ Easy to add new backends (just update config)
- ✅ Clean separation of concerns
- ✅ 86 unit tests for deterministic logic

---

## Breaking Changes

### 1. No Standalone CLI

**V1:**
```bash
npm install -g codeagora
codeagora review --branch main
```

**V2:**
```bash
# Must use within Claude Code
/agora review
/agora config
/agora status
```

**Reason:** V2 is a Claude Code skill, not a standalone CLI.

### 2. Configuration Format

**V1 Config (`codeagora.config.json`):**
```json
{
  "head_agent": { "provider": "opencode", "model": "..." },
  "supporters": {
    "codex": { "enabled": false },
    "gemini": { "enabled": false }
  },
  "reviewers": [
    { "provider": "opencode", "model": "opencode/kimi-k2.5-free" }
  ]
}
```

**V2 Config (`codeagora.config.json`):**
```json
{
  "reviewers": [
    {
      "id": "reviewer-1",
      "backend": "codex",          // ← backend (not provider)
      "model": "o4-mini",          // ← model format varies by backend
      "enabled": true,
      "timeout": 120
    }
  ],
  "settings": {
    "debate": {
      "enabled": true,
      "majority_threshold": 0.75
    }
  }
}
```

**Key Differences:**
- `provider` → `backend` (clearer terminology)
- No `head_agent` (Claude Code is the head agent)
- No `supporters` (all reviewers are equal)
- Added `settings.debate` for debate configuration

### 3. Backend Model Formats

Each backend has different model naming:

| Backend | V1 Format | V2 Format | Example |
|---------|-----------|-----------|---------|
| Codex   | N/A       | Model only | `"o4-mini"` |
| Gemini  | N/A       | Ignored (managed in settings.json) | `"gemini-2.5-flash"` |
| OpenCode | `provider/model` | `provider/model` | `"opencode/kimi-k2.5-free"` |

**V2 allows mixing backends:**
```json
{
  "reviewers": [
    { "backend": "codex", "model": "o4-mini" },
    { "backend": "gemini", "model": "gemini-2.5-flash" },
    { "backend": "opencode", "model": "github-copilot/claude-haiku-4.5" }
  ]
}
```

### 4. Removed Files

All `src/` directory files have been removed or archived:

**Removed (Replaced by):**
- `src/cli/index.ts` → `.claude/skills/agora-review.md`
- `src/pipeline/index.ts` → Claude Code orchestration
- `src/llm/adapter.ts` → Direct backend CLI calls
- `src/reviewer/executor.ts` → Bash commands in skill doc
- `src/head/synthesizer.ts` → Claude Code synthesis
- `src/debate/engine.ts` → `tools/src/commands/score.ts`, `anonymize.ts`, `early-stop.ts`
- `src/debate/judge.ts` → `tools/src/commands/voting.ts`
- `src/parser/` → `tools/src/utils/parser.ts`

**Preserved (Migrated to tools/):**
- Parser logic → `tools/src/utils/parser.ts`
- Voting logic → `tools/src/commands/voting.ts`
- Debate logic → `tools/src/commands/{anonymize,score,early-stop}.ts`
- All tests → `tools/tests/` (86 tests, 100% passing)

### 5. Execution Model

**V1:**
```bash
# Standalone executable
codeagora review
```

**V2:**
```bash
# Claude Code skill command
/agora review

# Or use the skill directly
# (Claude Code reads .claude/skills/agora-review.md)
```

---

## Migration Steps

### Step 1: Update Configuration

1. Copy your V1 config:
   ```bash
   cp codeagora.config.json codeagora.config.json.backup
   ```

2. Create new V2 config:
   ```bash
   cp codeagora.config.example.json codeagora.config.json
   ```

3. Migrate settings:
   - Convert `reviewers[].provider` → `reviewers[].backend`
   - Update model formats (see table above)
   - Remove `head_agent` (no longer needed)
   - Remove `supporters` (reviewers are now equal)
   - Add `settings.debate` if using debate features

### Step 2: Install Backend CLIs

V2 requires backend CLIs to be installed:

```bash
# Codex (optional)
npm install -g @openai/codex
export OPENAI_API_KEY="sk-..."

# Gemini (optional)
npm install -g @google/gemini-cli
export GEMINI_API_KEY="..."

# OpenCode (optional)
npm install -g opencode-ai@latest
# Configure providers in OpenCode settings

# macOS: Install GNU timeout
brew install coreutils
```

**At least one backend must be installed.**

### Step 3: Build Tools Package

```bash
cd tools
pnpm install
pnpm build
```

Verify:
```bash
node dist/index.js --help
# Should show 6 commands: parse-reviews, voting, anonymize, score, early-stop, format-output
```

### Step 4: Test the Skill

1. Make some code changes:
   ```bash
   echo "// Test change" >> README.md
   git add README.md
   ```

2. Run review:
   ```bash
   /agora review
   ```

3. Verify output shows:
   - Git diff extraction
   - Parallel reviewer execution
   - Majority voting results
   - Debate (if triggered)
   - Final synthesis by Claude Code

### Step 5: Update Scripts

**Remove V1 scripts:**
```bash
# Delete any references to codeagora CLI
npm uninstall -g codeagora
```

**Update CI/CD:**
```yaml
# Before (V1)
- run: codeagora review --branch main

# After (V2) - Not applicable
# CodeAgora V2 is a Claude Code skill, not a CI/CD tool
# Use GitHub Actions + other review bots for CI/CD
```

---

## Behavior Changes

### 1. Synthesis Agent

**V1:** TypeScript code in `src/head/synthesizer.ts`
**V2:** Claude Code (LLM-powered)

**Impact:** V2 synthesis is more intelligent and context-aware.

### 2. Debate Process

**V1:** Simple voting, no anti-conformity
**V2:**
- 75% majority voting gate
- Anti-conformity prompts (Free-MAD)
- Trajectory scoring
- Early stopping (Jaccard similarity)

**Impact:** V2 produces higher-quality consensus with fewer unnecessary debates.

### 3. Parallel Execution

**V1:** Sequential (one reviewer at a time)
**V2:** True parallel (all reviewers run simultaneously)

**Impact:** V2 is much faster (30-40s for 6 reviewers vs. 2+ minutes in V1).

### 4. Error Handling

**V1:** Single failure stops entire pipeline
**V2:** Individual reviewer failures are skipped, pipeline continues

**Impact:** V2 is more resilient.

---

## Troubleshooting

### "Command not found: /agora"

**Cause:** Claude Code doesn't recognize the skill.

**Fix:**
1. Verify skill files exist:
   ```bash
   ls -la .claude/skills/agora-review.*
   ```
2. Restart Claude Code
3. Try invoking directly in chat (may need to type `/agora`)

### "No timeout command found"

**Cause:** macOS doesn't have `timeout` by default.

**Fix:**
```bash
brew install coreutils
# Skill will auto-detect gtimeout
```

### "Backend CLI not found"

**Cause:** Backend CLI not installed.

**Fix:**
```bash
# Install the required backend
npm install -g @openai/codex        # for codex
npm install -g @google/gemini-cli   # for gemini
npm install -g opencode-ai@latest   # for opencode
```

### "Parse failures" in output

**Cause:** Reviewer output doesn't match expected format.

**Fix:**
- Check `parse_failed` entries in parse output
- Verify backend CLI is working: `codex --version`
- Try simpler prompt or different backend

### TypeScript errors

**Cause:** Trying to compile old V1 code.

**Fix:**
```bash
# Archive old code if not already done
mkdir -p .archive
mv src .archive/src-v1-backup

# Update configs (see migration steps)
```

---

## FAQ

### Can I use V1 and V2 together?

No. V2 completely replaces V1. The architectures are incompatible.

### Do I need to keep the old `src/` directory?

No. It's archived in `.archive/src-v1-*/` for reference. You can delete it:
```bash
rm -rf .archive/
```

### Can I add a new backend?

Yes! V2 makes this easy:

1. Add to config:
   ```json
   {
     "reviewers": [
       {
         "id": "my-backend",
         "backend": "mybackend",
         "model": "model-name",
         "enabled": true,
         "timeout": 120
       }
     ]
   }
   ```

2. Update skill doc (`.claude/skills/agora-review.md`) to add CLI call:
   ```bash
   mybackend)
     mybackend-cli --prompt "${FULL_PROMPT}" > /tmp/agora-review-${reviewer}-${TS}.txt &
     ;;
   ```

No TypeScript code needed!

### Is the tools package still a TypeScript CLI?

Yes, but it's a **helper library**, not the main CLI. It provides deterministic functions (parsing, voting, scoring) that Claude Code calls via `node tools/dist/index.js <command>`.

### How do I run tests?

```bash
pnpm test        # Run all 86 tests
pnpm typecheck   # Check TypeScript
pnpm build       # Build tools package
```

### Can I use this in CI/CD?

V2 is designed for interactive use with Claude Code, not CI/CD. For automated reviews, consider:
- GitHub Actions + Danger.js
- Review bots (CodeRabbit, etc.)
- V1 (if you need standalone CLI)

---

## Rollback (If Needed)

If you need to rollback to V1:

1. Restore old code:
   ```bash
   mv .archive/src-v1-* src/
   ```

2. Restore old config:
   ```bash
   mv codeagora.config.json.backup codeagora.config.json
   ```

3. Reinstall dependencies:
   ```bash
   pnpm install
   pnpm build
   ```

4. Commit hash for V1 (last known good):
   ```
   Check git log for "Initial commit" or before V2 migration
   ```

---

## Summary

| Aspect | V1 | V2 |
|--------|----|----|
| **Type** | Standalone CLI | Claude Code Skill |
| **Language** | TypeScript | Bash + TypeScript (tools only) |
| **Backends** | OpenCode only | Codex, Gemini, OpenCode |
| **Orchestration** | TypeScript pipeline | Claude Code + bash |
| **Synthesis** | TypeScript code | Claude Code (LLM) |
| **Parallel** | No | Yes |
| **Tests** | 86 | 86 (migrated) |
| **Build** | Failed (errors) | Success (0 errors) |
| **Debate** | Basic voting | Free-MAD + scoring |

**Recommendation:** Use V2 for all new projects. V1 is deprecated and will not receive updates.

---

## Need Help?

- **Documentation:** See `README.md` and `.claude/skills/agora-review.md`
- **Issues:** Check `V2_CLEANUP_COMPLETE.md` for verification steps
- **Plan:** See `.claude/plans/snappy-meandering-koala.md` for full design

**Migration completed:** 2026-02-16
