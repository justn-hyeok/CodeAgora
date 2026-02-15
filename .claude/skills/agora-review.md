# CodeAgora Multi-Agent Review

Multi-agent code review system where heterogeneous LLMs independently review code, vote on issues, and debate conflicts to reach high-quality consensus.

## Commands

- `review` - Run multi-agent code review on current git diff
- `config` - View or modify reviewer configuration
- `status` - Check backend CLI installation status

## Core Concepts

**75% Majority Voting Gate**: Issues with ≥75% reviewer agreement skip debate (reduces debate load by 60-80%)

**Debate Triggers** (4-stage):
1. Critical issues without strong majority
2. Severity conflicts across reviewers
3. Low-confidence warnings (<0.7) with unanimous agreement
4. Multiple reviewers (3+) flag same location

**Anti-Conformity Prompts**: Prevents groupthink by emphasizing independent analysis and resistance to majority pressure

**Trajectory Scoring**: 5-pattern quality scoring (code reference, technical depth, evidence-based reasoning, specific examples, code snippets)

---

## Prerequisites

Tools 패키지가 빌드되어 있어야 합니다:

```bash
cd tools && pnpm install && pnpm build
```

이 문서에서 `agora <command>`는 다음과 동일합니다:

```bash
node tools/dist/index.js <command>
```

**macOS 사용자**: `timeout` 명령이 없으면 GNU coreutils를 설치하세요:

```bash
brew install coreutils
```

설치 후 `gtimeout`이 사용 가능합니다. 이 문서의 `timeout`은 macOS에서 `gtimeout`으로 대체하세요.

---

## 8-Step Process

When you invoke `/agora review`, follow these steps sequentially:

### Step 1: Extract Git Diff

Extract the current git diff for review.

```bash
# Generate shared timestamp for this review session
TS=$(date +%s)
git diff --unified=3 main HEAD > /tmp/agora-diff-${TS}.txt
```

**Validation**:
- Check that diff is not empty
- If empty, inform user: "No changes detected. Nothing to review."
- Store timestamp variable `${TS}` for use in all subsequent steps

---

### Step 2: Load Configuration

Load and validate the configuration file.

```bash
cat codeagora.config.example.json
```

**Validation checklist**:
- [ ] Config file exists
- [ ] At least `min_reviewers` enabled reviewers present
- [ ] All enabled reviewers have valid backend values (`codex`, `gemini`, or `opencode`)
- [ ] Debate settings present (if debate enabled)

**If validation fails**:
- Missing config: Guide user to create from example
- Insufficient reviewers: List enabled reviewers, show minimum required
- Invalid backend: List valid options

**Extract these values**:
- `reviewers[]` - Array of reviewer configs
- `settings.min_reviewers` - Minimum successful reviews required
- `settings.max_parallel` - Max parallel reviewer executions
- `settings.debate.enabled` - Whether to run debates
- `settings.debate.majority_threshold` - Consensus threshold (default 0.75)
- `settings.debate.max_rounds` - Max debate rounds (default 3)

---

### Step 3: Run Parallel Reviews

Execute all enabled reviewers in parallel using their respective backend CLIs.

**Backend CLI Syntax** (CRITICAL - use these exact commands):

**Codex Backend** (`"backend": "codex"`):
```bash
# Non-interactive exec mode
codex exec -m <model> "<full_prompt>"

# Example:
codex exec -m o4-mini "$(cat prompts/review-system.md)

---

$(cat /tmp/agora-diff-${TS}.txt)"
```

**Gemini Backend** (`"backend": "gemini"`):
```bash
# Positional argument or -p flag (model managed in ~/.gemini/settings.json)
gemini -p "<full_prompt>" --output-format json

# Example:
gemini -p "$(cat prompts/review-system.md)

---

$(cat /tmp/agora-diff-${TS}.txt)" --output-format json
```

**OpenCode Backend** (`"backend": "opencode"`):
```bash
# Run subcommand with provider/model format
opencode run --model <provider/model> "<full_prompt>"

# Example:
opencode run --model github-copilot/claude-haiku-4.5 "$(cat prompts/review-system.md)

---

$(cat /tmp/agora-diff-${TS}.txt)"
```

**Prompt Strategy**:
All 3 backends lack `--system-prompt` flag, so merge system and user prompts:
```bash
SYSTEM_PROMPT="$(cat prompts/review-system.md)"
DIFF_CONTENT="$(cat /tmp/agora-diff-${TS}.txt)"
FULL_PROMPT="${SYSTEM_PROMPT}

---

${DIFF_CONTENT}"
```

**Model Field Format** (backend-specific):
| Backend | Model Format | Example | CLI Usage |
|---------|--------------|---------|-----------|
| `codex` | Model name only | `"o4-mini"` | `-m o4-mini` |
| `gemini` | Ignored (uses settings.json) | `"gemini-2.5-flash"` | (no flag) |
| `opencode` | `provider/model` | `"github-copilot/grok-3-mini"` | `--model github-copilot/grok-3-mini` |

**Parallel Execution**:
```bash
# Cross-platform timeout helper
if command -v timeout &>/dev/null; then
  TIMEOUT_CMD="timeout"
elif command -v gtimeout &>/dev/null; then
  TIMEOUT_CMD="gtimeout"
else
  echo "⚠️  No timeout command found. Install: brew install coreutils"
  TIMEOUT_CMD=""  # Will run without timeout
fi

# Launch all reviewers in background
for reviewer in "${ENABLED_REVIEWERS[@]}"; do
  ${TIMEOUT_CMD:+$TIMEOUT_CMD $TIMEOUT} <backend_cli_command> > /tmp/agora-review-${reviewer}-${TS}.txt 2>&1 &
done

# Wait for all to complete
wait
```

**Timeout Handling**:
- Use `timeout` (Linux) or `gtimeout` (macOS with coreutils)
- If neither available, run without timeout (warning displayed)
- Wrap each command with `${TIMEOUT_CMD} <seconds>` (from config `reviewer.timeout`)
- If timeout occurs, mark reviewer as failed
- Continue if `successful_count >= min_reviewers`
- Abort if `successful_count < min_reviewers`

**Output Storage**:
- Save each reviewer output to `/tmp/agora-review-{reviewer-id}-${TS}.txt`
- Track which reviewers succeeded/failed

---

### Step 4: Parse Reviews

Parse all successful reviewer outputs into structured format.

```bash
node tools/dist/index.js parse-reviews "$(cat <<EOF
{
  "reviews": [
    {
      "reviewer": "reviewer-1",
      "file": "src/auth.ts",
      "response": "$(cat /tmp/agora-review-reviewer-1-${TS}.txt)"
    },
    {
      "reviewer": "reviewer-2",
      "file": "src/auth.ts",
      "response": "$(cat /tmp/agora-review-reviewer-2-${TS}.txt)"
    }
  ]
}
EOF
)" > /tmp/agora-parsed-${TS}.json
```

**Expected Output Schema**:
```json
{
  "parsedReviews": [
    {
      "reviewer": "reviewer-1",
      "file": "src/auth.ts",
      "issues": [
        {
          "severity": "critical",
          "category": "Security",
          "line": 42,
          "title": "SQL Injection",
          "description": "...",
          "suggestion": "...",
          "confidence": 0.85
        }
      ],
      "parseFailures": [
        {
          "raw": "Some unparseable text",
          "reason": "No severity marker found"
        }
      ]
    }
  ]
}
```

**Parse Failure Handling**:
- Preserve unparseable content in `parseFailures[]`
- Report to user: "Reviewer X had Y unparseable blocks"
- Continue with successfully parsed issues

---

### Step 5: Majority Voting Gate

Apply 75% threshold to separate consensus from debate issues.

```bash
node tools/dist/index.js voting "$(cat <<EOF
{
  "reviews": $(cat /tmp/agora-parsed-${TS}.json | jq '.parsedReviews'),
  "threshold": 0.75
}
EOF
)" > /tmp/agora-voting-${TS}.json
```

**Expected Output Schema**:
```json
{
  "consensusIssues": [
    {
      "issueGroup": { "file": "...", "line": 10, "title": "..." },
      "agreedSeverity": "warning",
      "confidence": 0.75,
      "debateRequired": false,
      "voters": ["reviewer-1", "reviewer-2", "reviewer-3"]
    }
  ],
  "debateIssues": [
    {
      "issueGroup": { "file": "...", "line": 25, "title": "..." },
      "severityDistribution": { "critical": 1, "warning": 2 },
      "confidence": 0.33,
      "debateRequired": true,
      "opinions": [...]
    }
  ],
  "stats": {
    "totalIssueGroups": 10,
    "consensus": 7,
    "needsDebate": 3
  }
}
```

**Decision Path**:
```
if debateIssues.length === 0:
  → Skip to Step 7 (Synthesis)
else if debate.enabled === false:
  → Skip to Step 7 (treat debateIssues as weak consensus)
else:
  → Proceed to Step 6 (Conduct Debate)
```

---

### Step 6: Conduct Debate (Conditional)

Run multi-round debate for conflicting issues.

**Debate Loop** (for each debateIssue):

```bash
for round in 1 2 3; do
  # 1. Load round-specific prompt
  ROUND_PROMPT="$(cat prompts/debate-round${round}.md)"

  # 2. Anonymize opponent opinions (remove reviewer names, group by severity)
  ANONYMIZED="$(node tools/dist/index.js anonymize "$(cat <<EOF
{
  "opinions": $(jq '.debateIssues[0].opinions' /tmp/agora-voting-${TS}.json)
}
EOF
)")"

  # 3. Build debate context
  DEBATE_CONTEXT="${ROUND_PROMPT}

---

**Issue**: ${ISSUE_TITLE} at ${FILE}:${LINE}

**Current Opinions** (anonymized):
${ANONYMIZED}

**Your previous position** (if round > 1):
${YOUR_PREV_REASONING}

---

Please provide your updated analysis:"

  # 4. Invoke each participant using their backend CLI (same syntax as Step 3)
  # Use the same cross-platform timeout helper from Step 3
  for reviewer in "${DEBATE_PARTICIPANTS[@]}"; do
    BACKEND=$(get_reviewer_backend "$reviewer")  # from config
    MODEL=$(get_reviewer_model "$reviewer")       # from config

    case "$BACKEND" in
      codex)
        ${TIMEOUT_CMD:+$TIMEOUT_CMD $TIMEOUT} codex exec -m ${MODEL} "${DEBATE_CONTEXT}" \
          > /tmp/agora-debate-r${round}-${reviewer}-${TS}.txt 2>&1 &
        ;;
      gemini)
        ${TIMEOUT_CMD:+$TIMEOUT_CMD $TIMEOUT} gemini -p "${DEBATE_CONTEXT}" --output-format json \
          > /tmp/agora-debate-r${round}-${reviewer}-${TS}.txt 2>/tmp/agora-stderr-debate-r${round}-${reviewer}-${TS}.log &
        ;;
      opencode)
        ${TIMEOUT_CMD:+$TIMEOUT_CMD $TIMEOUT} opencode run --model ${MODEL} "${DEBATE_CONTEXT}" \
          > /tmp/agora-debate-r${round}-${reviewer}-${TS}.txt 2>&1 &
        ;;
    esac
  done
  wait

  # 5. Score each argument (Trajectory Scoring)
  for reviewer in "${DEBATE_PARTICIPANTS[@]}"; do
    REASONING="$(cat /tmp/agora-debate-r${round}-${reviewer}-${TS}.txt)"
    SCORE="$(node tools/dist/index.js score "{\"reasoning\": \"${REASONING}\"}" | jq '.score')"
    echo "${reviewer}: ${SCORE}" >> /tmp/agora-scores-r${round}-${TS}.txt
  done

  # 6. Check early stop (Jaccard similarity > 90%)
  PARTICIPANTS_JSON="$(build_participants_json)"  # Helper function
  SHOULD_STOP="$(node tools/dist/index.js early-stop "$(cat <<EOF
{
  "participants": ${PARTICIPANTS_JSON},
  "minRounds": 2,
  "similarityThreshold": 0.9
}
EOF
)" | jq '.shouldStop')"

  if [ "$SHOULD_STOP" = "true" ]; then
    echo "Early stop triggered at round ${round}"
    break
  fi

  # 7. Detect consensus (≥80% strong, ≥60% majority)
  # Count severity distribution after this round
  # If consensus reached, break
done
```

**Round Prompts** (from `prompts/`):

**Round 1** (`debate-round1.md`):
- Emphasize independent analysis
- "State your technical position based on code evidence"
- No mention of other reviewers yet

**Round 2** (`debate-round2.md`) - **Anti-Conformity Critical**:
```markdown
IMPORTANT: You are NOT required to change your position to match the majority.

Quality over consensus: A single well-supported argument can outweigh multiple weak ones.

Review the anonymized opinions below. If you disagree, explain why with specific code evidence.
```

**Round 3** (`debate-round3.md`):
- "This is the final round. Make your strongest technical case."
- Include trajectory scores from Round 2
- Highlight highest-scoring arguments

**Debate Output**:
```json
{
  "debateResults": [
    {
      "issueGroup": { "file": "...", "line": 30, "title": "..." },
      "finalSeverity": "warning",
      "rounds": 3,
      "finalReasoning": "After 3 rounds, the majority converged on...",
      "trajectoryScores": {
        "reviewer-1": 0.9,
        "reviewer-2": 0.7
      }
    }
  ]
}
```

---

### Step 7: Synthesize Final Review

**As Claude Code (Head Agent)**, perform final synthesis and output.

**Synthesis Process**:
1. Combine all consensus issues
2. Incorporate debate results
3. Apply your own judgment as head agent:
   - Flag any issues reviewers missed
   - Upgrade/downgrade severities if strongly justified
   - Add strategic recommendations

**Output Formats**:

**Terminal Output** (`--output terminal`, default):
```markdown
# Code Review Report

## Summary
- **Total Issues**: 15
- **Consensus Issues**: 12
- **Debated Issues**: 3

## 🔴 CRITICAL (2 issues)

**src/auth.ts:42** - SQL Injection
- Confidence: 85% (3 reviewers)
- Suggestion: Use parameterized queries

## 🟡 WARNING (8 issues)
...

## 🔵 SUGGESTION (5 issues)
...

---
_Generated by CodeAgora Multi-Agent Review System_
```

**Markdown File** (`--output md`):
```bash
node tools/dist/index.js format-output "$(cat <<EOF
{
  "consensusIssues": $(jq '.consensusIssues' /tmp/agora-voting-${TS}.json),
  "debateIssues": [],
  "debateResults": $(cat /tmp/agora-debate-results-${TS}.json)
}
EOF
)" | jq -r '.markdown' > codeagora-review-${TS}.md
```

**User Presentation**:
- Display summary statistics
- Show highest-severity issues first
- Include confidence levels and reviewer counts
- Highlight debated issues separately
- Provide file:line references for easy navigation

---

### Step 8: Logging & Cleanup

**Logging**:
```bash
mkdir -p .codeagora/logs

# Create comprehensive log
cat > .codeagora/logs/review-${TS}.json <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "diff": "$(cat /tmp/agora-diff-${TS}.txt | base64)",
  "config": $(cat codeagora.config.example.json),
  "reviewers": {
    "successful": ["reviewer-1", "reviewer-2"],
    "failed": ["reviewer-3"],
    "timeouts": []
  },
  "stats": {
    "totalIssues": 15,
    "consensusIssues": 12,
    "debateIssues": 3,
    "debatesHeld": 3,
    "avgDebateRounds": 2.3
  },
  "performance": {
    "reviewTime": "45s",
    "debateTime": "120s",
    "totalTime": "165s"
  }
}
EOF
```

**Cleanup**:
```bash
# Remove all temporary files for this session
rm -f /tmp/agora-diff-${TS}.txt
rm -f /tmp/agora-review-*-${TS}.txt
rm -f /tmp/agora-parsed-${TS}.json
rm -f /tmp/agora-voting-${TS}.json
rm -f /tmp/agora-debate-*-${TS}.txt
rm -f /tmp/agora-scores-*-${TS}.txt
rm -f /tmp/agora-debate-results-${TS}.json
rm -f /tmp/agora-stderr-*-${TS}.log  # Gemini CLI stderr logs
```

**Performance Metrics**:
- Report total time taken
- Show time per phase (review, voting, debate, synthesis)
- Indicate if early stopping occurred

---

## Error Handling Rules

**Rule 1: Reviewer Timeout**
```
IF reviewer times out:
  → Skip reviewer
  → IF successful_count >= min_reviewers:
      → Continue with available reviews
  → ELSE:
      → Abort with error: "Insufficient reviewers completed (X/Y)"
```

**Rule 2: Parse Failure**
```
IF parsing fails for some content:
  → Preserve in parseFailures[]
  → Report to user: "Reviewer X had Y unparseable blocks"
  → Continue with successfully parsed issues
  → IF zero issues parsed from all reviewers:
      → Abort with error: "All reviewers produced unparseable output"
```

**Rule 3: Debate Failure**
```
IF debate round fails:
  → Log error
  → Use pre-debate positions for final synthesis
  → Report: "Debate incomplete, using initial positions"
```

**Rule 4: Insufficient Reviewers**
```
IF successful_count < min_reviewers:
  → Abort immediately
  → Show which reviewers failed/timed out
  → Suggest: Check backend CLI installation with /agora status
```

**Rule 5: Empty Diff**
```
IF git diff is empty:
  → Inform user: "No changes detected. Nothing to review."
  → Exit gracefully (not an error)
```

---

## Additional Commands

### `/agora config`

View or modify reviewer configuration.

**View Current Config**:
```bash
cat codeagora.config.example.json | jq .
```

**Show Enabled Reviewers**:
```bash
jq '.reviewers[] | select(.enabled == true) | {id, backend, model}' codeagora.config.example.json
```

**Interactive Modification** (if user requests):
- Ask which setting to modify
- Validate new value
- Update config file with `jq`
- Confirm changes

**Example: Enable/Disable Reviewer**:
```bash
# Disable reviewer-3
jq '.reviewers[2].enabled = false' codeagora.config.example.json > tmp.json && mv tmp.json codeagora.config.example.json
```

---

### `/agora status`

Check backend CLI installation status.

```bash
echo "=== Backend CLI Status ==="

# Codex
if command -v codex &> /dev/null; then
  echo "✓ Codex CLI: $(codex --version 2>&1 | head -1)"
else
  echo "✗ Codex CLI: Not installed"
  echo "  Install: npm i -g @openai/codex"
fi

# Gemini
if command -v gemini &> /dev/null; then
  echo "✓ Gemini CLI: $(gemini --version 2>&1 | head -1)"
else
  echo "✗ Gemini CLI: Not installed"
  echo "  Install: npm install -g @google/gemini-cli"
fi

# OpenCode
if command -v opencode &> /dev/null; then
  echo "✓ OpenCode CLI: $(opencode version 2>&1 | head -1)"
else
  echo "✗ OpenCode CLI: Not installed"
  echo "  Install: npm i -g opencode-ai@latest"
fi

echo ""
echo "=== Configuration Status ==="

# Check config file
if [ -f "codeagora.config.example.json" ]; then
  ENABLED=$(jq '.reviewers[] | select(.enabled == true)' codeagora.config.example.json | jq -s 'length')
  MIN_REQ=$(jq '.settings.min_reviewers' codeagora.config.example.json)
  echo "✓ Config file exists"
  echo "  Enabled reviewers: ${ENABLED}"
  echo "  Minimum required: ${MIN_REQ}"

  if [ "$ENABLED" -ge "$MIN_REQ" ]; then
    echo "  Status: Ready ✓"
  else
    echo "  Status: Need more reviewers ✗"
  fi
else
  echo "✗ Config file not found"
  echo "  Create: cp codeagora.config.example.json codeagora.config.json"
fi

echo ""
echo "=== Tools Package Status ==="

# Check if tools are built
if [ -d "tools/dist" ]; then
  echo "✓ Tools package built"
else
  echo "✗ Tools package not built"
  echo "  Build: cd tools && pnpm install && pnpm build"
fi
```

---

## Requirements

**Backend CLIs** (at least one required):
- **Codex CLI**: `npm i -g @openai/codex` ([docs](https://www.npmjs.com/package/@openai/codex))
- **Gemini CLI**: `npm install -g @google/gemini-cli` ([docs](https://www.npmjs.com/package/@google/gemini-cli))
- **OpenCode CLI**: `npm i -g opencode-ai@latest` ([docs](https://github.com/sst/opencode))

**Tools Package**:
```bash
cd tools
pnpm install
pnpm build
```

**Configuration**:
- Copy `codeagora.config.example.json` to your preferred location
- Enable at least `min_reviewers` reviewers
- Set valid backend values for each reviewer

---

## Quick Start

1. **Check status**: `/agora status`
2. **Configure reviewers**: Edit `codeagora.config.example.json`
3. **Run review**: `/agora review`
4. **Review output**: See terminal or `.md` file

---

## Troubleshooting

**"Command not found: agora"**
→ Build tools package: `cd tools && pnpm build`

**"Insufficient reviewers completed"**
→ Check backend installations: `/agora status`
→ Increase timeout in config
→ Reduce `min_reviewers` requirement

**"All reviewers produced unparseable output"**
→ Check reviewer prompts in `prompts/review-system.md`
→ Ensure prompts request structured output format
→ Test individual backend CLIs manually

**"Debate not converging"**
→ Increase `max_rounds` in config
→ Check `debate-round2.md` for anti-conformity language
→ Review trajectory scores to identify weak arguments

---

## Performance Tips

**Optimize Review Time**:
- Use faster models for initial screening (haiku, grok-3-mini)
- Reserve slower models (opus, o4) for debate rounds
- Increase `max_parallel` for faster parallel execution

**Reduce Debate Load**:
- Adjust `majority_threshold` (higher = fewer debates)
- Enable `early_stop` to terminate converged debates
- Use trajectory scoring to identify low-quality arguments early

**Improve Accuracy**:
- Use heterogeneous model combinations (avoid all same model)
- Ensure at least 4 reviewers for robust majority voting
- Enable debate for critical severity issues
- Review and refine system prompts based on output quality

---

## Academic Background

**Debate or Vote (Zhang et al.)**:
Multi-agent debate improves reasoning quality but is expensive. Majority voting provides fast consensus but may miss nuances. CodeAgora combines both: vote first (75% gate), debate only conflicts.

**Free-MAD (Anti-Conformity)**:
Conformity bias in multi-agent systems leads to groupthink. Free-MAD introduces anti-conformity prompts that emphasize independent judgment and resistance to majority pressure, significantly improving debate quality.

**Trajectory Scoring**:
Not all arguments are equal. Scoring arguments based on code references, technical depth, and evidence-based reasoning helps identify high-quality positions and prevents weak arguments from dominating debates.
