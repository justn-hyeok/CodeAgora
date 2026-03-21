# Configuration

CodeAgora reads `.ca/config.json` (or `.ca/config.yaml`) from the current working directory.

Run `agora init` to generate a starter config, or create one manually.

## Example Config

```json
{
  "reviewers": [
    {
      "id": "r1",
      "model": "llama-3.3-70b-versatile",
      "backend": "api",
      "provider": "groq",
      "enabled": true,
      "timeout": 120
    },
    {
      "id": "r2",
      "model": "llama-3.3-70b-versatile",
      "backend": "api",
      "provider": "groq",
      "enabled": true,
      "timeout": 120
    }
  ],
  "supporters": {
    "pool": [{ "id": "s1", "model": "llama-3.3-70b-versatile", "backend": "api", "provider": "groq", "enabled": true, "timeout": 120 }],
    "pickCount": 1,
    "pickStrategy": "random",
    "devilsAdvocate": { "id": "da", "model": "llama-3.3-70b-versatile", "backend": "api", "provider": "groq", "enabled": true, "timeout": 120 },
    "personaPool": [".ca/personas/strict.md"],
    "personaAssignment": "random"
  },
  "moderator": {
    "model": "llama-3.3-70b-versatile",
    "backend": "api",
    "provider": "groq"
  },
  "discussion": {
    "maxRounds": 4,
    "registrationThreshold": {
      "HARSHLY_CRITICAL": 1,
      "CRITICAL": 1,
      "WARNING": 2,
      "SUGGESTION": null
    },
    "codeSnippetRange": 10
  },
  "errorHandling": {
    "maxRetries": 2,
    "forfeitThreshold": 0.7
  }
}
```

## Key Fields

**`reviewers`** — L1 reviewer agents. Use different providers and models for heterogeneous coverage.

**`supporters.pool`** — L2 agents that validate issues during discussion.

**`supporters.devilsAdvocate`** — Agent that argues against the majority to surface overlooked counterarguments.

**`supporters.personaPool`** — Markdown files describing reviewer personas (e.g., strict, pragmatic, security-focused). Assigned randomly or round-robin.

**`head`** — L3 Head agent config. When set, uses LLM to evaluate reasoning quality instead of rule-based counting.

**`discussion.registrationThreshold`** — Controls which severity levels trigger a discussion round:
- `HARSHLY_CRITICAL: 1` — one reporter is enough
- `CRITICAL: 1` — one reporter with supporter agreement
- `WARNING: 2` — requires at least two reporters
- `SUGGESTION: null` — skips discussion, goes to `suggestions.md`

**`errorHandling.forfeitThreshold`** — If this fraction of reviewers fail, the pipeline aborts. Default `0.7` means the pipeline continues as long as 30% of reviewers succeed.

## `.reviewignore`

Place a `.reviewignore` file in your project root to exclude files from review. Uses `.gitignore` syntax:

```
dist/**
*.min.js
coverage/**
tests/fixtures/**
```

## CLI Config Commands

```bash
agora config                           # Display loaded config
agora config-set discussion.maxRounds 3 # Set value (dot notation)
agora config-edit                      # Open in $EDITOR
agora language ko                      # Switch to Korean
```
