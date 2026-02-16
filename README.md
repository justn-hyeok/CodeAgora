# CodeAgora

**Where LLMs Debate Your Code**

![Tests](https://img.shields.io/badge/tests-86%20passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-85%25-green)
![Phase](https://img.shields.io/badge/phase-production--ready-blue)

Multi-agent code review system powered by heterogeneous LLMs with debate-driven consensus.

## Overview

CodeAgora orchestrates multiple AI reviewers to independently analyze your code, then facilitates structured debates when opinions conflict. This approach combines the diversity of different AI models with rigorous reasoning to catch more issues and reduce false positives.

### Key Features

- **🎭 Heterogeneous Models**: Codex, Gemini, OpenCode - different error profiles, better coverage
- **🗳️ 75% Majority Voting Gate**: Filters ~60-80% of non-controversial issues automatically
- **⚖️ Structured Debate**: Only triggers for genuine conflicts, not frivolous disagreements
- **🧠 Anti-Conformity Prompts**: Prevents groupthink, preserves minority positions with strong evidence
- **🤖 Claude Code Orchestration**: Seamless integration as a Claude Code skill

## How It Works

```
1. Extract git diff
2. Parallel independent reviews → [Codex, Gemini, OpenCode, ...]
3. Majority voting gate (75% threshold)
   ├─ Strong consensus → Skip to synthesis
   └─ Conflict detected → Structured debate (max 3 rounds)
4. Claude Code synthesizes final review
```

### Academic Foundation

- **Debate or Vote** (Du et al.): Multi-agent debate improves reasoning quality
- **Free-MAD** (Chen et al.): Anti-conformity prompts prevent consensus bias
- **Heterogeneous Ensembles**: Different models = different blind spots

## Quick Start

### Prerequisites

**Required:**
- [Claude Code](https://docs.anthropic.com/claude-code)

**Backend CLIs** (at least one):
- **Codex CLI**: `npm i -g @openai/codex` ([docs](https://www.npmjs.com/package/@openai/codex))
- **Gemini CLI**: `npm install -g @google/gemini-cli` ([docs](https://www.npmjs.com/package/@google/gemini-cli))
- **OpenCode CLI**: `npm i -g opencode-ai@latest` ([docs](https://github.com/sst/opencode))

**macOS Users:**
- Install coreutils for timeout support: `brew install coreutils`

### Installation

```bash
# Clone repository
git clone <repo-url>
cd oh-my-codereview

# Build tools package
cd tools
pnpm install
pnpm build
cd ..

# Copy config template
cp codeagora.config.example.json codeagora.config.json

# Edit config to enable your backends
vim codeagora.config.json
```

### Usage

```bash
# Run code review via Claude Code
/agora review

# Check backend status
/agora status

# Configure reviewers
/agora config
```

## Configuration

Example `codeagora.config.json`:

```json
{
  "reviewers": [
    {
      "id": "reviewer-1",
      "name": "Codex Reviewer",
      "backend": "codex",
      "model": "o4-mini",
      "enabled": true,
      "timeout": 120
    },
    {
      "id": "reviewer-2",
      "name": "Gemini Reviewer",
      "backend": "gemini",
      "model": "gemini-2.5-flash",
      "enabled": true,
      "timeout": 120
    }
  ],
  "settings": {
    "min_reviewers": 4,
    "max_parallel": 6,
    "output_format": "terminal",
    "debate": {
      "enabled": true,
      "majority_threshold": 0.75,
      "max_rounds": 3,
      "early_stop": true
    }
  }
}
```

### Backend-Specific Model Formats

| Backend | Model Format | Example |
|---------|-------------|---------|
| `codex` | Model name only | `"o4-mini"` |
| `gemini` | Managed in settings | `"gemini-2.5-flash"` |
| `opencode` | `provider/model` | `"github-copilot/claude-haiku-4.5"` |

## Architecture

### V2.0 (Current): Claude Code Orchestration

```
Claude Code (Orchestrator + Head Agent)
    ↓
Backend CLIs (Codex, Gemini, OpenCode)
    ↓
codeagora-tools (Deterministic helpers)
```

**Key Components:**

1. **Claude Code**: Orchestrates entire process, acts as head agent for final synthesis
2. **Backend CLIs**: Execute reviewer LLMs (heterogeneous models)
3. **codeagora-tools**: Deterministic logic (voting, scoring, anonymization)

### Tools Package

Six CLI commands for deterministic processing:

- `parse-reviews` - Parse raw reviewer responses
- `voting` - Apply 75% majority voting gate
- `anonymize` - Remove reviewer names for debate
- `score` - Trajectory scoring (5 regex patterns)
- `early-stop` - Jaccard similarity check
- `format-output` - Generate markdown reports

## Development

### Tools Package

```bash
cd tools

# Development
pnpm dev

# Type check
pnpm typecheck

# Test
pnpm test

# Build
pnpm build
```

### Project Structure

```
oh-my-codereview/
├── .claude/skills/          # Claude Code skill
│   ├── agora-review.md
│   └── agora-review.json
├── prompts/                 # Prompt templates
│   ├── review-system.md
│   ├── debate-round1.md
│   ├── debate-round2.md
│   └── debate-round3.md
├── tools/                   # Helper tools package
│   ├── src/
│   │   ├── commands/        # CLI commands
│   │   ├── types/           # TypeScript types
│   │   └── utils/           # Parser utilities
│   └── tests/
└── codeagora.config.json    # Configuration
```

## Performance

**E2E Test Results** (Phase 3 validation):

| Metric | Result |
|--------|--------|
| 2 reviewers, 50-line diff | ~40 seconds |
| Parse accuracy | 100% (0 failures) |
| Issue detection | Caught all security vulnerabilities |
| Debate reduction | 60-80% via majority voting gate |

**Key Metrics:**
- **Majority gate efficiency**: 60-80% of issues bypass debate
- **Individual reviewer time**: 12-26 seconds (model-dependent)
- **Anti-conformity**: Preserves minority positions with strong technical evidence
- **Projected**: 6 reviewers in parallel = ~30-35 seconds (limited by slowest reviewer)

## Known Limitations

- **macOS timeout**: Requires `brew install coreutils` for timeout support (auto-detected fallback available)
- **Gemini CLI output**: Responses wrapped in JSON format (auto-extracted by parser)
- **Gemini stderr warnings**: Skill conflict warnings redirected to separate log files
- **Codex CLI**: Requires OpenAI API key configured in environment
- **OpenCode CLI**: Requires provider API keys in config (GitHub Copilot, etc.)
- **Backend availability**: Review quality depends on enabled backends and API availability

## Contributing

We welcome contributions! Key areas:

- Additional backend integrations
- Improved debate strategies
- Enhanced scoring algorithms
- Test coverage

## License

MIT

## References

- Du, Y., et al. (2023). Improving Factuality and Reasoning in Language Models through Multiagent Debate.
- Chen, W., et al. (2024). Free-MAD: Multi-Agent Debate with Free Selection of Opinions.
// CodeAgora V2 test - 2026-02-16
