# Changelog

## 1.1.0 (2026-03-17)

### Features
- **Strict/Pragmatic review modes** — per-mode presets with tailored thresholds and personas
- **Korean language support** — full Korean prompts in L2/L3, language config (`en`/`ko`)
- **Auto-approve** — trivial diff detection (comments, blanks, docs-only) bypasses LLM pipeline
- **Custom rules** — `.reviewrules` YAML for regex-based static pattern checks, merged into L1 results
- **Confidence score** — 0–100 per issue based on reviewer agreement, adjusted by L2 consensus
- **Learning loop** — persist dismissed patterns to `.ca/learned-patterns.json`, auto-suppress frequently dismissed patterns
- **`agora learn`** — `--from-pr <number>` CLI command to learn from past reviews
- **Enhanced GitHub discussions** — round-by-round detail with consensus icons, native code suggestion blocks
- **Severity escalation** — escalate to CRITICAL when file path matching fails
- **Quantitative hints** — added to L3 verdict prompt for better decision quality
- **Strict mode** — WARNING >= 3 triggers NEEDS_HUMAN
- **Init wizard improvements** — mode/language selection, head config in all default templates

### Bug Fixes
- Comprehensive stability fixes — circuit breaker, deduplication, lint cleanup
- Dead code cleanup + TUI fixes
- Stability fixes Phase 2-3 (28 remaining issues)

### Internal
- Switched `action.yml` from source build to `npm install`
- Security-focused persona included in strict mode preset

## 1.0.3 (2026-03-17)

### Bug Fixes
- Generate default persona files during `init`

### Docs
- Add logo and update badge colors to match brand

## 1.0.2 (2026-03-17)

### Bug Fixes
- Drop Node 18 from CI (ESLint 10 requires Node 20+)

### Docs
- Add npm/npx install instructions to README

## 1.0.1 (2026-03-17)

Patch release — version bump only (no functional changes).

## 1.0.0 (2026-03-17)

First stable release. All features from rc.1–rc.8 consolidated.

### Features
- **GitHub Actions integration** — inline PR review comments, commit status checks, SARIF output
- **15 API providers** — OpenAI, Anthropic, Google, Groq, DeepSeek, Qwen, Mistral, xAI, Together, Cerebras, NVIDIA NIM, ZAI, OpenRouter, GitHub Models, GitHub Copilot
- **5 CLI backends** — claude, codex, gemini, copilot, opencode
- **LLM-based Head verdict** — L3 Head agent uses LLM to evaluate reasoning quality (rule-based fallback)
- **Majority consensus** — checkConsensus handles >50% agree/disagree votes
- **Semantic file grouping** — import-relationship-based clustering for reviewer distribution
- **Reviewer personas** — strict, pragmatic, security-focused persona files
- **Configurable chunking** — maxTokens settable via config
- **NEEDS_HUMAN handling** — auto-request human reviewers + add labels
- **SARIF 2.1.0 output** — GitHub Code Scanning compatible
- **Secure credentials** — API keys stored in ~/.config/codeagora/credentials
- **TUI paste support** — clipboard paste works in all text inputs
- **CLI --pr flag** — review GitHub PRs directly from command line
- **Parallel chunk processing** — adaptive concurrency for large diffs

### Bug Fixes
- Fix dist build crash (locale JSON not bundled)
- Fix discussion matching (exact filePath:line instead of substring)
- Fix division by zero in forfeit threshold
- Fix CLI flags (--provider, --model, --timeout, --no-discussion) being ignored
- Fix GitHub Action multiline output corruption
- Fix parser "looks good" false negative
- Fix inline comment position errors (fallback to summary-only)
- Strip ANSI codes in doctor format tests for CI compatibility
- Remove unused imports that fail CI lint

## 1.0.0-rc.1 to rc.7

Initial development releases. See git history for details.
