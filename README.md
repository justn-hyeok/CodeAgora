# Oh My CodeReview

Multi-LLM collaborative code review pipeline that leverages multiple AI models to provide comprehensive code reviews.

## Features

- 🤖 **Multi-Model Review**: Execute multiple LLM reviewers in parallel
- 🎯 **Smart Synthesis**: Aggregate and deduplicate issues across reviewers
- 🔍 **Debate Detection**: Automatically detect when issues require deeper analysis
- 📊 **Comprehensive Reports**: Get detailed markdown and terminal reports
- ⚙️ **Configurable**: Customize reviewers, models, and settings

## Installation

```bash
pnpm install
pnpm build
```

## Quick Start

1. Initialize configuration:

```bash
npx oh-my-codereview init
```

2. Review your code:

```bash
npx oh-my-codereview review
```

Or review a specific diff file:

```bash
npx oh-my-codereview review path/to/file.diff
```

## Configuration

Edit `oh-my-codereview.config.json` to customize:

- **Reviewers**: Enable/disable models, set timeouts
- **Settings**: Minimum reviewers, parallel execution limit
- **Output Format**: Choose between JSON, text, or markdown

Example configuration:

```json
{
  "head_agent": {
    "provider": "anthropic",
    "model": "claude-sonnet-4"
  },
  "reviewers": [
    {
      "name": "deepseek",
      "provider": "deepseek",
      "model": "deepseek-chat",
      "enabled": true,
      "timeout": 300
    }
  ],
  "settings": {
    "min_reviewers": 3,
    "max_parallel": 5,
    "output_format": "markdown"
  }
}
```

## Review Output

The tool provides:

- **Critical/Major/Minor/Suggestion** severity levels
- **Line-specific** issue identification
- **Confidence scores** for each issue
- **Multiple reviewer consensus** on each issue
- **Debate triggers** for conflicting opinions

## Development

```bash
# Run tests
pnpm test

# Watch mode
pnpm test:watch

# Build
pnpm build

# Development mode
pnpm dev -- review path/to/diff
```

## Architecture

```
Config → Diff Extraction → Parallel Review → Parsing → Synthesis → Report
```

1. **Config Loading**: Load and validate configuration
2. **Diff Extraction**: Extract git diff or load from file
3. **Parallel Review**: Execute multiple reviewers concurrently
4. **Parsing**: Parse natural language responses into structured data
5. **Synthesis**: Aggregate and deduplicate issues
6. **Report**: Generate terminal and markdown reports

## Testing

The project includes comprehensive test coverage:

- Config system validation
- Diff parsing and splitting
- Prompt template loading
- Response parsing (18 test cases)
- Integration tests

```bash
pnpm test                # Run all tests
pnpm test:coverage       # Generate coverage report
```

## Phase 1 Status

✅ Completed:
- Config system with validation
- Diff extraction and file filtering
- Prompt management
- Multi-reviewer parallel execution
- Response parser with fallback handling
- Debate trigger detection
- Issue synthesis and deduplication
- Terminal and markdown reports

🚧 Future (Phase 2+):
- GitHub PR integration
- Discord real-time notifications
- Actual debate execution
- Feedback loops

## License

MIT

## Credits

Built with:
- TypeScript
- Zod (validation)
- Commander (CLI)
- Chalk (terminal colors)
- Vitest (testing)
