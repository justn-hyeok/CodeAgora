# OpenCode Backend Setup

## Overview

This project uses **OpenCode CLI** as the backend for executing LLM reviews. OpenCode provides a unified interface for multiple LLM providers.

## Architecture

```
oh-my-codereview → OpenCode CLI → LLM Providers (Anthropic, OpenAI, Google, DeepSeek)
```

Each reviewer is executed as:
```bash
opencode run --model <provider>/<model> --format json "review prompt"
```

## Prerequisites

### 1. Install OpenCode CLI

```bash
# Via Homebrew (macOS)
brew install opencode

# Or via npm
npm install -g opencode-cli

# Verify installation
opencode --version
```

### 2. Configure API Keys

OpenCode needs access to API keys for each provider. There are two ways:

#### Option A: Environment Variables (Recommended)

OpenCode automatically reads from standard environment variables:

```bash
# .env file (already configured)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
DEEPSEEK_API_KEY=sk-...
```

#### Option B: OpenCode Auth

```bash
# Add credentials via OpenCode CLI
opencode auth add anthropic
opencode auth add openai
opencode auth add google
opencode auth add deepseek

# List configured providers
opencode auth list
```

## Usage

### Test OpenCode Integration

```bash
# Test a single provider
echo "Say hello" | opencode run --model anthropic/claude-sonnet-4

# Test with JSON format (what our code uses)
opencode run --model anthropic/claude-sonnet-4 --format json "Explain async/await"
```

### Run Code Review

```bash
# Using the CLI
pnpm dev -- review

# Or review a specific diff
pnpm dev -- review path/to/file.diff
```

## Supported Models

OpenCode supports the following providers and models (as configured):

| Provider | Model | Timeout | Status |
|----------|-------|---------|--------|
| **anthropic** | claude-opus-4 | 600s | ✅ Enabled |
| **anthropic** | claude-sonnet-4 | 300s | ✅ Enabled |
| **openai** | gpt-4o | 300s | ✅ Enabled |
| **openai** | o1 | 300s | ✅ Enabled (supporter) |
| **google** | gemini-2.0-flash-thinking-exp | 300s | ✅ Enabled |
| **deepseek** | deepseek-chat | 300s | ✅ Enabled |
| **xai** | grok-2-latest | 300s | ❌ Disabled |

## Configuration

### Backend Selection

In `oh-my-codereview.config.json`:

```json
{
  "settings": {
    "backend": "opencode"  // or "direct" for API calls without OpenCode
  }
}
```

### Model Format

OpenCode uses `provider/model` format:
- `anthropic/claude-opus-4`
- `openai/gpt-4o`
- `google/gemini-2.0-flash-thinking-exp`
- `deepseek/deepseek-chat`

### Timeout Settings

Different models require different timeouts:
- **Reasoning models** (o1, claude-opus): 600s
- **Standard models**: 300s

## Troubleshooting

### "opencode: command not found"

```bash
# Install OpenCode
brew install opencode
# or
npm install -g opencode-cli
```

### "API key not found"

```bash
# Check environment variables
echo $ANTHROPIC_API_KEY
echo $OPENAI_API_KEY

# Or add via OpenCode
opencode auth add anthropic
```

### "Model not supported"

```bash
# Check available models
opencode debug agent <agent-name>

# List all agents
opencode agent list
```

### Review fails with timeout

Increase timeout in config:
```json
{
  "reviewers": [
    {
      "name": "claude-opus",
      "timeout": 900  // 15 minutes
    }
  ]
}
```

## Performance Considerations

### Parallel Execution

The tool executes up to `max_parallel` reviewers simultaneously:

```json
{
  "settings": {
    "max_parallel": 5  // Run 5 OpenCode processes at once
  }
}
```

### Costs

OpenCode CLI calls use the same API pricing as direct calls:
- **Claude Opus 4**: Most expensive, highest quality
- **Claude Sonnet 4**: Balanced cost/performance
- **GPT-4o**: Competitive pricing
- **Gemini 2.0 Flash**: Fast and cheap
- **DeepSeek**: Very cheap, good quality

Consider disabling expensive models for large codebases.

## Switching Backends

### From OpenCode to Direct API

```json
{
  "settings": {
    "backend": "direct"
  }
}
```

Direct API calls are faster (no subprocess overhead) but require provider-specific client implementations.

### From Direct API to OpenCode

```json
{
  "settings": {
    "backend": "opencode"
  }
}
```

OpenCode provides unified interface and supports more providers.

## Advanced Usage

### Custom OpenCode Options

Edit `src/llm/adapter.ts` to add custom OpenCode flags:

```typescript
const args = [
  'run',
  '--model', `${request.provider}/${request.model}`,
  '--format', 'json',
  '--thinking',  // Show reasoning for o1 models
  '--variant', 'high',  // Reasoning effort
];
```

### Debugging

```bash
# Enable OpenCode logs
opencode run --log-level DEBUG --model anthropic/claude-sonnet-4 "test"

# Check OpenCode config
opencode debug config

# Test specific provider
opencode debug agent anthropic
```

## See Also

- [Setup Guide](../SETUP.md) - General setup instructions
- [Config Schema](../src/config/schema.ts) - Configuration options
- [OpenCode Docs](https://opencode.ai/docs) - Official documentation
