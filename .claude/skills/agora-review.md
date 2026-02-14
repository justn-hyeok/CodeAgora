# CodeAgora Review Skill

**Prefix:** `agora:`

Multi-agent code review with debate-driven consensus. Multiple LLMs review code in parallel, debate conflicting opinions, and reach consensus on issues.

---

## Commands

### `/agora:review` - Run Code Review

Run multi-agent code review on git diff.

**Usage:**
```
/agora:review
/agora:review --file src/auth.ts
/agora:review --staged
/agora:review --branch main
```

**Options:**
- `--file <path>` - Review specific file only
- `--staged` - Review staged changes only
- `--branch <name>` - Compare against branch (default: main)

**Process:**
1. Extract git diff
2. Run parallel reviews (all enabled reviewers in config)
3. Detect conflicts (severity disagreements, low confidence)
4. Conduct debate if needed (max 3 rounds with anti-conformity prompts)
5. Synthesize final review with consensus

**Config:** `codeagora.config.json` (or `oh-my-codereview.config.json`)

**Required ENV:**
- `ANTHROPIC_API_KEY` - For Claude models
- `OPENAI_API_KEY` - For GPT models
- `GOOGLE_API_KEY` - For Gemini models
- `XAI_API_KEY` - For Grok models
- `MINIMAX_API_KEY` - For Minimax models
- `KIMI_API_KEY` - For Kimi models

---

### `/agora:config` - View/Edit Configuration

View current configuration or update settings.

**Usage:**
```
/agora:config
/agora:config --add-reviewer
/agora:config --set min_reviewers=2
```

**Displays:**
- Enabled reviewers (provider/model)
- Debate settings (thresholds, max rounds)
- Output preferences

---

### `/agora:status` - Check Provider Status

Check API key configuration and provider availability.

**Usage:**
```
/agora:status
```

**Shows:**
- Configured providers (API keys found)
- Missing API keys
- Estimated rate limits (if available)

---

## Implementation

When invoked, this skill executes the following:

```typescript
import { executeCommand } from './src/plugin/commands.js';

// Parse command from skill invocation
// e.g., "/agora:review --staged" → command="review", args={staged: true}
const [command, ...argPairs] = args.split(' ');
const parsedArgs: Record<string, string | boolean> = {};

for (const arg of argPairs) {
  if (arg.startsWith('--')) {
    const key = arg.slice(2);
    const [name, value] = key.split('=');
    parsedArgs[name] = value || true;
  }
}

// Execute command
const result = await executeCommand(command, {
  cwd: process.cwd(),
  args: parsedArgs,
});

// Display result
if (result.success) {
  console.log(result.output);
} else {
  console.error('Error:', result.error);
}
```

**Command Handlers:** `src/plugin/commands.ts`
- `reviewCommand()` - Run full pipeline
- `configCommand()` - Display configuration
- `statusCommand()` - Check API keys

---

## Architecture Notes

**LLM Adapter Layer:**
- Direct API calls (no CLI subprocess)
- Provider implementations: `src/llm/adapter.ts`
- API keys from environment: `src/llm/config.ts`

**Debate Engine:**
- Majority voting gate (75% threshold)
- Anonymization (severity-based grouping)
- Trajectory scoring (quality metrics)
- Anti-conformity prompts (prevent blind following)

**Core Logic:**
- `src/debate/engine.ts` - Debate orchestration
- `src/debate/judge.ts` - Conflict detection
- `src/head/synthesizer.ts` - Consensus synthesis

---

## Example Output

```
🔍 CodeAgora Multi-Agent Review

Reviewers: 3 (gpt-4o-mini, claude-3-5-sonnet, claude-3-5-haiku)

━━━ Issues Found ━━━

[CRITICAL] src/auth.ts:42
Security: SQL Injection vulnerability
Consensus: STRONG (3/3 agree)
  - All reviewers flagged unsanitized input
  - Debate: Not needed (unanimous)

[MAJOR] src/api.ts:15
Logic: Missing error handling
Consensus: MAJORITY (2/3 agree)
  - Debate: 2 rounds
  - Final: MAJOR (2 votes), MINOR (1 vote)

━━━ Summary ━━━

Total Issues: 5 (1 CRITICAL, 2 MAJOR, 2 MINOR)
Debates: 1 (2 rounds)
Duration: 8.3s
```

---

## Future Enhancements

(Structure only, not implemented):

- `/agora:debate` - Manually trigger debate on specific issue
- `/agora:history` - View recent review history
- `/agora:discord` - Set up Discord webhook for real-time updates
