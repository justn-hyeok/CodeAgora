# Phase 3 Implementation Plan: Discord Integration

## Overview
Add Discord webhook/bot integration for real-time debate visualization and human interaction.

**Duration**: Ralph Loop iterations 17-25 (estimated)
**Review Cycles**: Minimum 3 cycles after implementation

---

## Phase 3.1: Discord Webhook Integration

### Goals
- Send review results to Discord channels
- Format debate rounds as threaded messages
- Handle 2000-character Discord limit
- Agent-specific webhooks with names/avatars

### Implementation Tasks

#### 3.1.1: Discord Client Module
**File**: `src/discord/client.ts`
- `DiscordClient` class with webhook URL
- `sendMessage(content, options)` method
- `sendThread(parentId, content)` method
- `sendEmbed(embed)` for rich formatting
- 2000-char chunking logic
- Error handling (webhook fails don't crash pipeline)

#### 3.1.2: Discord Formatter
**File**: `src/discord/formatter.ts`
- `formatReviewSummary(synthesis)` - convert to Discord embed
- `formatDebateRound(round)` - format single debate round
- `formatIssue(issue)` - format single issue with severity colors
- `formatSupporterResults(results)` - supporter validation summary
- Color mapping: CRITICAL=red, HIGH=orange, MEDIUM=yellow, LOW=blue

#### 3.1.3: Config Schema Extension
**File**: `src/config/schema.ts`
- Add `discord` config section:
  ```typescript
  discord: {
    enabled: boolean;
    webhook_url: string;
    thread_per_pr?: boolean;
    mention_roles?: string[];
  }
  ```

#### 3.1.4: Pipeline Integration
**File**: `src/pipeline/index.ts`
- Import `DiscordClient`
- After synthesis, send to Discord if enabled
- After debate, send debate rounds to Discord
- Handle errors gracefully (log but continue)

### Testing
- `tests/discord/client.test.ts` - webhook sending, chunking
- `tests/discord/formatter.test.ts` - format validation
- Mock Discord API responses
- Test 2000+ character messages

---

## Phase 3.2: Human Interaction Commands (OPTIONAL - Phase 3.5)

**Note**: This requires Discord bot with message read permissions. For MVP, we'll skip this and use webhooks only (send-only). Can add in Phase 3.5 if needed.

---

## Phase 3.3: Feedback Collection (OPTIONAL - Phase 3.5)

**Note**: Requires Discord bot to read reactions. For MVP, we'll skip and add in Phase 3.5.

---

## Phase 3 MVP Scope (for Ralph Loop)

### Core Features (Must Have)
1. ✅ Discord webhook client
2. ✅ Message formatting (embeds, colors)
3. ✅ 2000-char chunking
4. ✅ Config schema for Discord
5. ✅ Pipeline integration
6. ✅ Error handling (webhook fails don't crash)

### Deferred to Phase 3.5 (Nice to Have)
- ❌ Bot commands (!dismiss, !approve, etc.)
- ❌ Human interaction via Discord
- ❌ Reaction-based feedback
- ❌ SQLite tracking

**Rationale**: Webhook-only (send) is simpler than bot (read+write). Focus on visualization first, interaction later.

---

## Implementation Order

### Step 1: Discord Client (30 min)
- Create `src/discord/client.ts`
- Implement `DiscordClient` class
- Add webhook sending with error handling
- Add 2000-char chunking

### Step 2: Discord Formatter (30 min)
- Create `src/discord/formatter.ts`
- Implement embed formatting functions
- Add severity color mapping
- Format synthesis + debate

### Step 3: Config Schema (15 min)
- Update `src/config/schema.ts`
- Add Discord config section
- Update default config

### Step 4: Pipeline Integration (20 min)
- Update `src/pipeline/index.ts`
- Add Discord client initialization
- Send messages after synthesis
- Send debate rounds to Discord

### Step 5: Testing (45 min)
- Write `tests/discord/client.test.ts`
- Write `tests/discord/formatter.test.ts`
- Mock Discord API
- Test chunking, formatting, errors

### Step 6: Documentation (15 min)
- Update `README.md` with Discord setup
- Add Discord webhook URL to config example
- Document Discord message format

**Total Estimated Time**: 2.5 hours

---

## File Structure

```
src/
├── discord/
│   ├── client.ts       # Discord webhook client
│   ├── formatter.ts    # Message formatting
│   └── types.ts        # Discord types
├── config/
│   └── schema.ts       # Add discord config
└── pipeline/
    └── index.ts        # Add Discord integration

tests/
└── discord/
    ├── client.test.ts
    └── formatter.test.ts
```

---

## Success Criteria

- [ ] Discord client can send webhooks
- [ ] Messages properly formatted (embeds, colors)
- [ ] 2000+ char messages are chunked
- [ ] Config schema includes Discord
- [ ] Pipeline sends review results to Discord
- [ ] Tests: 100% passing (including Discord)
- [ ] TypeScript: 0 errors
- [ ] Build: Clean
- [ ] Review Cycle 1: Complete
- [ ] Review Cycle 2: Complete
- [ ] Review Cycle 3: APPROVE

---

## Dependencies

- `discord.js` or `axios` for webhook sending
- No new runtime dependencies needed (use native fetch or https)

---

## Risk Mitigation

1. **Webhook fails**: Catch errors, log, continue pipeline
2. **2000-char limit**: Implement chunking with "continued..." markers
3. **Rate limiting**: Add delay between messages if needed
4. **Network timeout**: Set reasonable timeout (5s)

---

## Next Steps After Phase 3

1. Run minimum 3 review cycles on Phase 3 code
2. Fix any issues found by reviewers
3. Achieve APPROVE verdicts
4. Continue to Phase 4 (Optimization + Extensions)

---

**Ready to begin implementation**: Step 1 - Discord Client
