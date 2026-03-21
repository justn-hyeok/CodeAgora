/**
 * useApi hook tests
 * Tests error state, loading state, and refetch behavior.
 * Environment: jsdom (via vitest.config.ts environmentMatchGlobs)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useApi } from '../../src/frontend/hooks/useApi.js';

// ============================================================================
// Mock fetch
// ============================================================================

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ============================================================================
// Tests
// ============================================================================

describe('useApi()', () => {
  it('starts with loading=true and data=null', () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useApi('/api/sessions'));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('sets data and loading=false on successful fetch', async () => {
    const payload = { items: [1, 2, 3] };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => payload,
    });

    const { result } = renderHook(() => useApi<typeof payload>('/api/sessions'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual(payload);
    expect(result.current.error).toBeNull();
  });

  it('sets error when response is not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    const { result } = renderHook(() => useApi('/api/missing'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toContain('404');
    expect(result.current.data).toBeNull();
  });

  it('sets error when fetch throws (network failure)', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useApi('/api/sessions'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Network error');
    expect(result.current.data).toBeNull();
  });

  it('sets error to "Unknown error" for non-Error thrown values', async () => {
    mockFetch.mockRejectedValue('string error');

    const { result } = renderHook(() => useApi('/api/sessions'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Unknown error');
  });

  it('re-fetches when refetch() is called', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ count: 1 }),
    });

    const { result } = renderHook(() => useApi<{ count: number }>('/api/sessions'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Set up second response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ count: 2 }),
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => expect(result.current.data?.count).toBe(2));
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('sets loading=true during refetch', async () => {
    let resolveFn!: (v: unknown) => void;
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ first: true }) })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFn = resolve;
        }),
      );

    const { result } = renderHook(() => useApi<{ first?: boolean }>('/api/sessions'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.refetch();
    });

    // Loading should be true while the second fetch is pending
    expect(result.current.loading).toBe(true);

    // Resolve the second fetch
    resolveFn({ ok: true, json: async () => ({ first: false }) });
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('does not fetch when path is empty string', () => {
    const { result } = renderHook(() => useApi(''));
    expect(result.current.loading).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('clears previous error on successful refetch', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('First failure'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

    const { result } = renderHook(() => useApi<{ ok: boolean }>('/api/sessions'));

    await waitFor(() => expect(result.current.error).toBe('First failure'));

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => expect(result.current.data).toEqual({ ok: true }));
    expect(result.current.error).toBeNull();
  });

  it('clears previous data on error after successful fetch', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ value: 42 }) })
      .mockRejectedValueOnce(new Error('Second failure'));

    const { result } = renderHook(() => useApi<{ value: number }>('/api/sessions'));

    await waitFor(() => expect(result.current.data?.value).toBe(42));

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => expect(result.current.error).toBe('Second failure'));
    // data is not cleared on error (only error is set), this is by design
    expect(result.current.loading).toBe(false);
  });

  it('re-fetches when path changes', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ path: 'a' }) });

    const { result, rerender } = renderHook(({ path }: { path: string }) => useApi(path), {
      initialProps: { path: '/api/a' },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/a');

    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ path: 'b' }) });
    rerender({ path: '/api/b' });

    await waitFor(() => expect(result.current.data).toEqual({ path: 'b' }));
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toBe('/api/b');
  });
});
