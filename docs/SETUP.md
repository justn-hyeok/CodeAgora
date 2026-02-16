# CodeAgora Setup Guide

Complete setup instructions for the CodeAgora multi-agent code review system.

## Prerequisites

1. **Node.js**: v18+ required
2. **pnpm**: Package manager
3. **Claude Code**: For running the `/agora` skill
4. **Backend CLIs**: At least one of:
   - Codex CLI
   - Gemini CLI  
   - OpenCode CLI

## Installation Steps

### 1. Clone and Setup

```bash
# Clone repository
cd ~/Projects
git clone <your-repo-url> oh-my-codereview
cd oh-my-codereview

# Install and build tools package
cd tools
pnpm install
pnpm build
cd ..
```

### 2. Configure Reviewers

```bash
# Copy example config
cp codeagora.config.example.json codeagora.config.json

# Edit to match your backend setup
vim codeagora.config.json
```

**Key configuration points:**

- `reviewers[].backend`: Set to `"codex"`, `"gemini"`, or `"opencode"`
- `reviewers[].model`: Use correct format for each backend
- `reviewers[].enabled`: Set to `true` for backends you have installed
- `settings.min_reviewers`: Minimum successful reviews required (default: 4)

### 3. Install Backend CLIs

Choose at least one:

#### Option A: OpenCode CLI

```bash
npm install -g opencode-cli

# Verify installation
opencode version
```

#### Option B: Codex CLI

```bash
# Installation instructions TBD
codex --version
```

#### Option C: Gemini CLI

```bash
# Installation instructions TBD
gemini --version
```

### 4. Test Installation

```bash
# Test tools package
cd tools
node dist/index.js parse-reviews '{"reviews":[]}'

# Should output: {"parsedReviews":[]}
```

## Usage

### Basic Review

```bash
# From Claude Code
/agora review
```

### Check Status

```bash
/agora status
```

This will show which backend CLIs are installed and ready.

### Configure

```bash
/agora config
```

View or modify reviewer configuration.

## Troubleshooting

### Tools build fails

```bash
cd tools
rm -rf node_modules dist
pnpm install
pnpm build
```

### Backend CLI not found

Make sure the CLI is in your PATH:

```bash
which opencode  # or codex, gemini
```

If not found, reinstall or check your shell configuration.

### Parse errors

Check that reviewer responses follow the expected format:

```
[severity] Category | L123 | Issue title
Description
Suggestion: Fix suggestion
Confidence: 0.8
```

### Insufficient reviewers

Ensure at least `min_reviewers` backends are:
1. Installed
2. Enabled in config
3. Not timing out

## Advanced Configuration

### Custom Timeouts

```json
{
  "reviewers": [{
    "timeout": 180  // 3 minutes for slow models
  }]
}
```

### Debate Settings

```json
{
  "settings": {
    "debate": {
      "enabled": true,
      "majority_threshold": 0.8,  // Stricter consensus
      "max_rounds": 5,            // More rounds
      "early_stop": false         // Disable early stopping
    }
  }
}
```

### Output Format

```json
{
  "settings": {
    "output_format": "terminal"  // or "md" for markdown files
  }
}
```

## Uninstallation

```bash
cd ~/Projects/oh-my-codereview

# Remove tools
cd tools
pnpm uninstall

# Remove project
cd ../..
rm -rf oh-my-codereview
```

## Getting Help

- **Issues**: GitHub issues page
- **Documentation**: See README.md
- **Examples**: Check `prompts/` for prompt templates
