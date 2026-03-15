# CodeAgora V3

3-layer multi-agent code review system.

## Architecture

```
L1 Reviewers (저가 모델 5개, 병렬)
    ↓
L2 Moderator + Supporters (중재자 + 검증자)
    ↓
L3 Head (Claude Code, 북엔드)
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Typecheck
pnpm typecheck
```

## Usage

```typescript
import { runPipeline } from 'codeagora-v3';

const result = await runPipeline({
  diffPath: '/path/to/diff.txt',
});

console.log(result.status); // 'success' or 'error'
console.log(result.sessionId); // '001', '002', etc.
```

## Configuration

Create `.ca/config.json`:

```json
{
  "reviewers": [
    {
      "id": "r1",
      "backend": "opencode",
      "provider": "kimi",
      "model": "kimi-k2.5",
      "enabled": true,
      "timeout": 120
    }
  ],
  "supporters": [
    {
      "id": "s1",
      "backend": "codex",
      "model": "o4-mini",
      "role": "검증자",
      "enabled": true
    }
  ],
  "moderator": {
    "backend": "codex",
    "model": "claude-sonnet"
  },
  "discussion": {
    "maxRounds": 3,
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

## Output Structure

```
.ca/
├── config.json
└── sessions/
    └── 2026-02-16/
        └── 001/
            ├── reviews/
            │   ├── r1-kimi-k2.5.md
            │   ├── r2-grok-fast.md
            │   └── ...
            ├── discussions/
            │   └── d001-sql-injection/
            │       ├── round-1.md
            │       ├── round-2.md
            │       └── verdict.md
            ├── unconfirmed/
            ├── suggestions.md
            ├── report.md       # Moderator final report
            └── result.md       # Head final verdict
```

## Testing

```bash
# Run all tests
pnpm test

# Run specific test
pnpm test -- l1-reviewer

# Run with coverage
pnpm test -- --coverage
```

## Development

### Project Structure

```
src-v3/
├── types/          # Type definitions
│   ├── core.ts
│   └── config.ts
├── utils/          # Utilities
│   └── fs.ts
├── config/         # Config loader
│   └── loader.ts
├── session/        # Session manager
│   └── manager.ts
├── l1/             # L1 Reviewers
│   ├── reviewer.ts
│   ├── parser.ts
│   ├── backend.ts
│   └── writer.ts
├── l2/             # L2 Moderator + Supporters
│   ├── threshold.ts
│   ├── moderator.ts
│   └── writer.ts
├── l3/             # L3 Head
│   ├── grouping.ts
│   ├── verdict.ts
│   └── writer.ts
├── pipeline/       # Orchestrator
│   └── orchestrator.ts
└── tests/          # Tests
    ├── session.test.ts
    ├── config.test.ts
    ├── l1-reviewer.test.ts
    ├── l2-threshold.test.ts
    └── e2e-pipeline.test.ts
```

## Slice Implementation Status

- ✅ Slice 1: Infrastructure (.ca/, config, session manager)
- ✅ Slice 2: L1 Reviewers (5 parallel)
- ✅ Slice 3: L2 Discussion + Moderator + Supporters
- ✅ Slice 4: L3 Head + Pipeline integration
- 🚧 Slice 5: Edge cases (in progress)

## Comparison with V2

| Feature | V2 | V3 |
|---------|----|----|
| Architecture | Flat (all reviewers equal) | 3-layer hierarchy |
| Voting | 75% majority gate | Severity-based threshold |
| Debate | 3-round CLI stateless | Discussion with evidence docs |
| Output | JSON + terminal | `.ca/` session structure |
| Head role | Final synthesis only | Bookend (grouping + verdict) |
| Supporters | None | Validators (검증자) |

## License

MIT
