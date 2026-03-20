/**
 * GitHub Review Mapper Tests
 * Tests mapToInlineCommentBody(), buildSummaryBody(), buildReviewBadgeUrl()
 */

import { describe, it, expect } from 'vitest';
import {
  mapToInlineCommentBody,
  buildSummaryBody,
  buildReviewBadgeUrl,
} from '../mapper.js';
import type { EvidenceDocument, DiscussionVerdict } from '@codeagora/core/types/core.js';
import type { PipelineSummary } from '@codeagora/core/pipeline/orchestrator.js';

// ============================================================================
// Helpers
// ============================================================================

function makeDoc(overrides: Partial<EvidenceDocument> = {}): EvidenceDocument {
  return {
    issueTitle: 'Null pointer dereference',
    problem: 'Value may be null at this point.',
    evidence: ['Line 42 dereferences without null check'],
    severity: 'CRITICAL',
    suggestion: 'Add a null check before use.',
    filePath: 'src/foo.ts',
    lineRange: [42, 45],
    ...overrides,
  };
}

function makeVerdict(overrides: Partial<DiscussionVerdict> = {}): DiscussionVerdict {
  return {
    discussionId: 'd001',
    filePath: 'src/foo.ts',
    lineRange: [42, 45],
    finalSeverity: 'CRITICAL',
    reasoning: 'All reviewers agreed this is critical.',
    consensusReached: true,
    rounds: 1,
    ...overrides,
  };
}

function makeSummary(overrides: Partial<PipelineSummary> = {}): PipelineSummary {
  return {
    decision: 'REJECT',
    reasoning: 'Critical issues found.',
    totalReviewers: 3,
    forfeitedReviewers: 0,
    severityCounts: { CRITICAL: 1 },
    topIssues: [],
    totalDiscussions: 1,
    resolved: 1,
    escalated: 0,
    ...overrides,
  };
}

// ============================================================================
// mapToInlineCommentBody
// ============================================================================

describe('mapToInlineCommentBody', () => {
  it('includes the issue title and severity badge', () => {
    const body = mapToInlineCommentBody(makeDoc());
    expect(body).toContain('CRITICAL');
    expect(body).toContain('Null pointer dereference');
  });

  it('includes the problem text', () => {
    const body = mapToInlineCommentBody(makeDoc());
    expect(body).toContain('Value may be null at this point.');
  });

  it('includes evidence items as a numbered list', () => {
    const body = mapToInlineCommentBody(makeDoc());
    expect(body).toContain('1. Line 42 dereferences without null check');
  });

  it('includes suggestion text when no code block is present', () => {
    const body = mapToInlineCommentBody(makeDoc());
    expect(body).toContain('Add a null check before use.');
  });

  it('wraps a code-block suggestion in ```suggestion fence', () => {
    const doc = makeDoc({
      suggestion: '```typescript\nif (x !== null) { use(x); }\n```',
    });
    const body = mapToInlineCommentBody(doc);
    expect(body).toContain('```suggestion');
    expect(body).toContain('if (x !== null) { use(x); }');
  });

  it('omits suggestion when postSuggestions is false', () => {
    const body = mapToInlineCommentBody(makeDoc(), undefined, undefined, {
      postSuggestions: false,
    });
    expect(body).not.toContain('Add a null check before use.');
  });

  it('includes reviewer ids when provided', () => {
    const body = mapToInlineCommentBody(makeDoc(), undefined, ['reviewer-a', 'reviewer-b']);
    expect(body).toContain('reviewer-a');
    expect(body).toContain('reviewer-b');
  });

  it('omits reviewer section when no reviewerIds provided', () => {
    const body = mapToInlineCommentBody(makeDoc());
    expect(body).not.toContain('Flagged by:');
  });

  it('includes collapsed discussion block when verdict is provided', () => {
    const body = mapToInlineCommentBody(makeDoc(), makeVerdict());
    expect(body).toContain('<details>');
    expect(body).toContain('d001');
    expect(body).toContain('All reviewers agreed this is critical.');
  });

  it('renders discussion inline when collapseDiscussions is false', () => {
    const body = mapToInlineCommentBody(makeDoc(), makeVerdict(), undefined, {
      collapseDiscussions: false,
    });
    expect(body).not.toContain('<details>');
    expect(body).toContain('All reviewers agreed this is critical.');
  });

  it('shows consensus icon when consensus was reached', () => {
    const body = mapToInlineCommentBody(makeDoc(), makeVerdict({ consensusReached: true }));
    // consensus = ✅
    expect(body).toContain('\u2705');
  });

  it('shows warning icon when consensus was NOT reached', () => {
    const body = mapToInlineCommentBody(makeDoc(), makeVerdict({ consensusReached: false }));
    // no consensus = ⚠️
    expect(body).toContain('\u26A0');
  });

  it('uses grey circle for unknown severity', () => {
    const doc = makeDoc({ severity: 'WARNING' });
    // Override to an unknown value via cast
    (doc as unknown as Record<string, string>).severity = 'UNKNOWN_SEV';
    const body = mapToInlineCommentBody(doc as EvidenceDocument);
    expect(body).toContain('UNKNOWN_SEV');
  });

  it('omits evidence section when evidence array is empty', () => {
    const doc = makeDoc({ evidence: [] });
    const body = mapToInlineCommentBody(doc);
    expect(body).not.toContain('**Evidence:**');
  });

  it('includes confidence badge when confidence is set', () => {
    const doc = makeDoc({ confidence: 95 });
    const body = mapToInlineCommentBody(doc);
    // getConfidenceBadge returns non-empty string for high confidence
    expect(body).toContain('Confidence');
  });
});

// ============================================================================
// buildSummaryBody
// ============================================================================

describe('buildSummaryBody', () => {
  it('contains the codeagora-v3 HTML marker', () => {
    const body = buildSummaryBody({
      summary: makeSummary(),
      sessionId: 'sess-001',
      sessionDate: '2026-03-21',
      evidenceDocs: [],
      discussions: [],
    });
    expect(body).toContain('<!-- codeagora-v3 -->');
  });

  it('includes the verdict decision and badge', () => {
    const body = buildSummaryBody({
      summary: makeSummary({ decision: 'ACCEPT' }),
      sessionId: 'sess-001',
      sessionDate: '2026-03-21',
      evidenceDocs: [],
      discussions: [],
    });
    expect(body).toContain('ACCEPT');
  });

  it('includes the summary reasoning text', () => {
    const body = buildSummaryBody({
      summary: makeSummary({ reasoning: 'No issues found at all.' }),
      sessionId: 'sess-001',
      sessionDate: '2026-03-21',
      evidenceDocs: [],
      discussions: [],
    });
    expect(body).toContain('No issues found at all.');
  });

  it('includes the session id in the footer', () => {
    const body = buildSummaryBody({
      summary: makeSummary(),
      sessionId: 'abc-xyz',
      sessionDate: '2026-03-21',
      evidenceDocs: [],
      discussions: [],
    });
    expect(body).toContain('abc-xyz');
  });

  it('renders a blocking issues table for CRITICAL docs', () => {
    const doc = makeDoc({ severity: 'CRITICAL' });
    const body = buildSummaryBody({
      summary: makeSummary(),
      sessionId: 'sess-001',
      sessionDate: '2026-03-21',
      evidenceDocs: [doc],
      discussions: [],
    });
    expect(body).toContain('### Blocking Issues');
    expect(body).toContain('Null pointer dereference');
  });

  it('renders a blocking issues table for HARSHLY_CRITICAL docs', () => {
    const doc = makeDoc({ severity: 'HARSHLY_CRITICAL' });
    const body = buildSummaryBody({
      summary: makeSummary(),
      sessionId: 'sess-001',
      sessionDate: '2026-03-21',
      evidenceDocs: [doc],
      discussions: [],
    });
    expect(body).toContain('HARSHLY CRITICAL');
  });

  it('renders collapsible warnings section', () => {
    const doc = makeDoc({ severity: 'WARNING', issueTitle: 'Missing guard clause' });
    const body = buildSummaryBody({
      summary: makeSummary(),
      sessionId: 'sess-001',
      sessionDate: '2026-03-21',
      evidenceDocs: [doc],
      discussions: [],
    });
    expect(body).toContain('warning(s)');
    expect(body).toContain('Missing guard clause');
  });

  it('renders collapsible suggestions section', () => {
    const doc = makeDoc({ severity: 'SUGGESTION', issueTitle: 'Consider extracting method' });
    const body = buildSummaryBody({
      summary: makeSummary(),
      sessionId: 'sess-001',
      sessionDate: '2026-03-21',
      evidenceDocs: [doc],
      discussions: [],
    });
    expect(body).toContain('suggestion(s)');
    expect(body).toContain('Consider extracting method');
  });

  it('renders open questions section for NEEDS_HUMAN verdict', () => {
    const body = buildSummaryBody({
      summary: makeSummary({ decision: 'NEEDS_HUMAN' }),
      sessionId: 'sess-001',
      sessionDate: '2026-03-21',
      evidenceDocs: [],
      discussions: [],
      questionsForHuman: ['Is this change intentional?', 'Review auth logic.'],
    });
    expect(body).toContain('### Open Questions');
    expect(body).toContain('Is this change intentional?');
    expect(body).toContain('Review auth logic.');
  });

  it('renders agent consensus log section when discussions are present', () => {
    const body = buildSummaryBody({
      summary: makeSummary(),
      sessionId: 'sess-001',
      sessionDate: '2026-03-21',
      evidenceDocs: [],
      discussions: [makeVerdict()],
    });
    expect(body).toContain('Agent consensus log');
    expect(body).toContain('d001');
  });

  it('renders suppressed issues section when suppressedIssues is provided', () => {
    const body = buildSummaryBody({
      summary: makeSummary(),
      sessionId: 'sess-001',
      sessionDate: '2026-03-21',
      evidenceDocs: [],
      discussions: [],
      suppressedIssues: [
        { filePath: 'src/foo.ts', lineRange: [1, 5], issueTitle: 'Old warning', dismissCount: 3 },
      ],
    });
    expect(body).toContain('suppressed by learned patterns');
    expect(body).toContain('Old warning');
    expect(body).toContain('dismissed 3 times previously');
  });

  it('renders issue distribution heatmap when evidenceDocs present', () => {
    const docs = [
      makeDoc({ filePath: 'src/a.ts' }),
      makeDoc({ filePath: 'src/a.ts' }),
      makeDoc({ filePath: 'src/b.ts' }),
    ];
    const body = buildSummaryBody({
      summary: makeSummary(),
      sessionId: 'sess-001',
      sessionDate: '2026-03-21',
      evidenceDocs: docs,
      discussions: [],
    });
    expect(body).toContain('Issue distribution');
    expect(body).toContain('src/a.ts');
  });
});

// ============================================================================
// buildReviewBadgeUrl
// ============================================================================

describe('buildReviewBadgeUrl', () => {
  it('returns a shields.io URL', () => {
    const url = buildReviewBadgeUrl('ACCEPT', {});
    expect(url).toContain('img.shields.io/badge/CodeAgora');
  });

  it('uses brightgreen color for ACCEPT', () => {
    const url = buildReviewBadgeUrl('ACCEPT', {});
    expect(url).toContain('brightgreen');
  });

  it('uses red color for REJECT', () => {
    const url = buildReviewBadgeUrl('REJECT', {});
    expect(url).toContain('red');
  });

  it('uses yellow color for NEEDS_HUMAN', () => {
    const url = buildReviewBadgeUrl('NEEDS_HUMAN', {});
    expect(url).toContain('yellow');
  });

  it('uses lightgrey for unknown decisions', () => {
    const url = buildReviewBadgeUrl('UNKNOWN', {});
    expect(url).toContain('lightgrey');
  });

  it('appends critical count to label when critical issues exist', () => {
    const url = buildReviewBadgeUrl('REJECT', { CRITICAL: 2, HARSHLY_CRITICAL: 1 });
    expect(url).toContain('3%20critical');
  });

  it('does not append critical count when counts are zero', () => {
    const url = buildReviewBadgeUrl('REJECT', { CRITICAL: 0, WARNING: 2 });
    expect(url).not.toContain('critical');
  });
});
