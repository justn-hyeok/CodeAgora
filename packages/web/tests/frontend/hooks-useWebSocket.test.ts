/**
 * useWebSocket hook tests
 * Tests reconnect behavior and message parsing.
 * Environment: jsdom (via vitest.config.ts environmentMatchGlobs)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWebSocket } from '../../src/frontend/hooks/useWebSocket.js';

// ============================================================================
// Mock WebSocket
// ============================================================================

type WsEventType = 'open' | 'message' | 'close' | 'error';

interface MockWsInstance {
  url: string;
  readyState: number;
  onopen: ((e: Event) => void) | null;
  onmessage: ((e: MessageEvent) => void) | null;
  onclose: ((e: CloseEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  triggerEvent: (type: WsEventType, data?: unknown) => void;
}

let wsInstances: MockWsInstance[] = [];

class MockWebSocket {
  url: string;
  readyState: number;
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  send = vi.fn();
  close = vi.fn();

  static OPEN = 1;
  static CLOSED = 3;

  constructor(url: string) {
    this.url = url;
    this.readyState = MockWebSocket.CLOSED;
    wsInstances.push(this as unknown as MockWsInstance);
  }

  triggerEvent(type: WsEventType, data?: unknown): void {
    if (type === 'open') {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event('open'));
    } else if (type === 'message') {
      this.onmessage?.(
        new MessageEvent('message', { data: typeof data === 'string' ? data : JSON.stringify(data) }),
      );
    } else if (type === 'close') {
      this.readyState = MockWebSocket.CLOSED;
      this.onclose?.(new CloseEvent('close'));
    } else if (type === 'error') {
      this.onerror?.(new Event('error'));
    }
  }
}

beforeEach(() => {
  wsInstances = [];
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', MockWebSocket);
  // Set window.location for URL construction
  Object.defineProperty(window, 'location', {
    value: { protocol: 'http:', host: 'localhost:3000' },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function getWs(index = 0): MockWsInstance {
  return wsInstances[index] as MockWsInstance;
}

// ============================================================================
// Tests
// ============================================================================

describe('useWebSocket()', () => {
  it('starts with connected=false and empty messages', () => {
    renderHook(() => useWebSocket('/ws'));
    expect(wsInstances).toHaveLength(1);
    const { result } = renderHook(() => useWebSocket('/ws'));
    expect(result.current.connected).toBe(false);
    expect(result.current.messages).toHaveLength(0);
  });

  it('sets connected=true on WebSocket open', async () => {
    const { result } = renderHook(() => useWebSocket('/ws'));

    act(() => {
      getWs().triggerEvent('open');
    });

    expect(result.current.connected).toBe(true);
  });

  it('sets connected=false when WebSocket closes', async () => {
    const { result } = renderHook(() => useWebSocket('/ws'));

    act(() => {
      getWs().triggerEvent('open');
    });
    expect(result.current.connected).toBe(true);

    act(() => {
      getWs().triggerEvent('close');
    });
    expect(result.current.connected).toBe(false);
  });

  it('parses valid JSON messages and appends to messages array', async () => {
    const { result } = renderHook(() => useWebSocket('/ws'));

    act(() => {
      getWs().triggerEvent('open');
      getWs().triggerEvent('message', { type: 'stage-start', stage: 'init' });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toEqual({ type: 'stage-start', stage: 'init' });
  });

  it('ignores non-JSON messages without throwing', async () => {
    const { result } = renderHook(() => useWebSocket('/ws'));

    act(() => {
      getWs().triggerEvent('open');
      // Simulate raw string that's not JSON
      getWs().onmessage?.(new MessageEvent('message', { data: 'not-json{{{' }));
    });

    expect(result.current.messages).toHaveLength(0);
  });

  it('caps the message buffer at 500 entries', async () => {
    const { result } = renderHook(() => useWebSocket('/ws'));

    act(() => {
      getWs().triggerEvent('open');
      for (let i = 0; i < 550; i++) {
        getWs().triggerEvent('message', { index: i });
      }
    });

    expect(result.current.messages).toHaveLength(500);
    // Should contain the last 500 messages (indices 50-549)
    const last = result.current.messages[499] as { index: number };
    expect(last.index).toBe(549);
  });

  it('sends data when send() is called and connection is open', () => {
    const { result } = renderHook(() => useWebSocket('/ws'));

    act(() => {
      getWs().triggerEvent('open');
    });

    act(() => {
      result.current.send('hello');
    });

    expect(getWs().send).toHaveBeenCalledWith('hello');
  });

  it('does not call ws.send() when connection is closed', () => {
    const { result } = renderHook(() => useWebSocket('/ws'));
    // Don't open — ws is closed

    act(() => {
      result.current.send('hello');
    });

    expect(wsInstances[0]?.send).not.toHaveBeenCalled();
  });

  it('reconnects after close using exponential backoff (first attempt: 1s)', async () => {
    renderHook(() => useWebSocket('/ws'));
    const firstWs = getWs(0);

    act(() => {
      firstWs.triggerEvent('open');
      firstWs.triggerEvent('close');
    });

    expect(wsInstances).toHaveLength(1); // not yet reconnected

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(wsInstances).toHaveLength(2); // new connection created
  });

  it('second reconnect uses 2s delay (backoff)', async () => {
    renderHook(() => useWebSocket('/ws'));
    const ws0 = getWs(0);

    // First close → reconnect after 1s
    act(() => {
      ws0.triggerEvent('open');
      ws0.triggerEvent('close');
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(wsInstances).toHaveLength(2);

    // Second close → reconnect after 2s
    act(() => {
      getWs(1).triggerEvent('close');
    });
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(wsInstances).toHaveLength(2); // not yet

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(wsInstances).toHaveLength(3); // reconnected
  });

  it('resets backoff attempt counter on successful open after reconnect', async () => {
    renderHook(() => useWebSocket('/ws'));

    // First connection opens then closes
    act(() => {
      getWs(0).triggerEvent('open');
      getWs(0).triggerEvent('close');
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Second connection opens (resets counter) then closes
    act(() => {
      getWs(1).triggerEvent('open');
      getWs(1).triggerEvent('close');
    });

    // After reset, delay should be 1s again (not 2s)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(wsInstances).toHaveLength(3);
  });

  it('constructs ws:// URL for http: location', () => {
    renderHook(() => useWebSocket('/api/ws'));
    expect(wsInstances[0]?.url).toBe('ws://localhost:3000/api/ws');
  });

  it('constructs wss:// URL for https: location', () => {
    Object.defineProperty(window, 'location', {
      value: { protocol: 'https:', host: 'example.com' },
      writable: true,
      configurable: true,
    });
    renderHook(() => useWebSocket('/api/ws'));
    // The second hook render creates a new ws instance
    const last = wsInstances[wsInstances.length - 1];
    expect(last?.url).toBe('wss://example.com/api/ws');
  });

  it('closes WebSocket and cancels reconnect on unmount', async () => {
    const { unmount } = renderHook(() => useWebSocket('/ws'));
    const ws = getWs(0);

    act(() => {
      ws.triggerEvent('open');
    });

    unmount();

    expect(ws.close).toHaveBeenCalled();
    // After unmount, advancing time should NOT create new instances
    const countBefore = wsInstances.length;
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(wsInstances.length).toBe(countBefore);
  });

  it('does not trigger reconnect if unmounted before close fires', async () => {
    const { unmount } = renderHook(() => useWebSocket('/ws'));
    act(() => {
      getWs(0).triggerEvent('open');
    });

    unmount(); // mark unmountedRef = true

    // Simulate close arriving after unmount
    act(() => {
      getWs(0).triggerEvent('close');
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // No new instances should have been created
    expect(wsInstances).toHaveLength(1);
  });
});
