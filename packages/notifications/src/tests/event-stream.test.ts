/**
 * Event Stream Handler Tests
 * Tests createEventStreamHandler() — forwards DiscussionEvents to generic webhook.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEventStreamHandler } from '../event-stream.js';
import type { GenericWebhookConfig } from '../generic-webhook.js';

// ============================================================================
// fetch mock
// ============================================================================

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, status: 200 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ============================================================================
// createEventStreamHandler
// ============================================================================

describe('createEventStreamHandler', () => {
  const config: GenericWebhookConfig = {
    url: 'https://example.com/events',
    secret: 'supersecretvalue123',
    events: ['all'],
  };

  it('returns a function', () => {
    const handler = createEventStreamHandler(config);
    expect(typeof handler).toBe('function');
  });

  it('calls fetch when a DiscussionEvent is forwarded', async () => {
    const handler = createEventStreamHandler(config);

    await handler({
      type: 'discussion-started',
      discussionId: 'd001',
      filePath: 'src/foo.ts',
      lineRange: [1, 5],
      severity: 'CRITICAL',
    } as never);

    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('forwards the event type as X-CodeAgora-Event header', async () => {
    const handler = createEventStreamHandler(config);

    await handler({
      type: 'discussion-resolved',
      discussionId: 'd002',
      filePath: 'src/bar.ts',
      lineRange: [10, 15],
      severity: 'WARNING',
    } as never);

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-CodeAgora-Event']).toBe(
      'discussion-resolved',
    );
  });

  it('includes HMAC signature in X-CodeAgora-Signature header', async () => {
    const handler = createEventStreamHandler(config);

    await handler({
      type: 'pipeline-complete',
      discussionId: 'd003',
      filePath: 'src/baz.ts',
      lineRange: [20, 25],
      severity: 'SUGGESTION',
    } as never);

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const sig = (init.headers as Record<string, string>)['X-CodeAgora-Signature'];
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('sends to the configured URL', async () => {
    const handler = createEventStreamHandler(config);

    await handler({
      type: 'round-complete',
      discussionId: 'd004',
      filePath: 'src/x.ts',
      lineRange: [1, 1],
      severity: 'WARNING',
    } as never);

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe('https://example.com/events');
  });

  it('does not call fetch when event is filtered out by config.events', async () => {
    const filteredConfig: GenericWebhookConfig = {
      url: 'https://example.com/events',
      secret: 'supersecretvalue123',
      events: ['pipeline-complete'], // only this event allowed
    };
    const handler = createEventStreamHandler(filteredConfig);

    await handler({
      type: 'discussion-started', // not in filter list
      discussionId: 'd005',
      filePath: 'src/y.ts',
      lineRange: [1, 1],
      severity: 'CRITICAL',
    } as never);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not throw when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const handler = createEventStreamHandler(config);

    await expect(
      handler({
        type: 'discussion-started',
        discussionId: 'd006',
        filePath: 'src/z.ts',
        lineRange: [1, 1],
        severity: 'WARNING',
      } as never),
    ).resolves.toBeUndefined();
  });
});
