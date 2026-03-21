/**
 * Tests for commands/dashboard.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Shared mock function so all dynamic imports of @codeagora/web share the same spy
const mockStartServer = vi.fn().mockReturnValue({ close: vi.fn() });

vi.mock('@codeagora/web', () => ({
  startServer: mockStartServer,
}));

vi.mock('@codeagora/shared/i18n/index.js', () => ({
  t: (key: string, args?: Record<string, unknown>) =>
    `${key}(${JSON.stringify(args ?? {})})`,
}));

describe('startDashboard', () => {
  beforeEach(() => {
    mockStartServer.mockClear();
    vi.spyOn(process, 'on').mockImplementation((_event, _handler) => process);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is exported as a function', async () => {
    const mod = await import('../commands/dashboard.js');
    expect(typeof mod.startDashboard).toBe('function');
  });

  it('calls startServer from @codeagora/web with the given port', async () => {
    const { startDashboard } = await import('../commands/dashboard.js');

    void startDashboard({ port: 7000 });

    // Flush microtask queue so the dynamic import inside startDashboard resolves
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockStartServer).toHaveBeenCalledWith({ port: 7000 });
  });

  it('defaults to port 6274 when no port is given', async () => {
    const { startDashboard } = await import('../commands/dashboard.js');

    void startDashboard({});

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockStartServer).toHaveBeenCalledWith({ port: 6274 });
  });
});
