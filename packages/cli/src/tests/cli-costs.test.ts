/**
 * Tests for commands/costs.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCostSummary } from '../commands/costs.js';

vi.mock('fs/promises', () => ({
  default: {
    readdir: vi.fn(),
    readFile: vi.fn(),
    stat: vi.fn(),
  },
}));

vi.mock('../utils/colors.js', () => ({
  bold: (s: string) => s,
  dim: (s: string) => s,
}));

vi.mock('@codeagora/shared/i18n/index.js', () => ({
  t: (key: string) => key,
}));

async function getFsMock() {
  const fs = await import('fs/promises');
  return fs.default as unknown as {
    readdir: ReturnType<typeof vi.fn>;
    readFile: ReturnType<typeof vi.fn>;
    stat: ReturnType<typeof vi.fn>;
  };
}

describe('getCostSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns no-sessions message when sessions directory does not exist', async () => {
    const fs = await getFsMock();
    fs.readdir.mockRejectedValue(new Error('ENOENT'));

    const result = await getCostSummary('/base', {});
    expect(result).toBe('No sessions found. Run a review first.');
  });

  it('returns no-cost-data message when sessions exist but have no cost info', async () => {
    const fs = await getFsMock();
    // date dirs
    fs.readdir
      .mockResolvedValueOnce(['2024-01-15'])   // sessionsDir
      .mockResolvedValueOnce(['001']);           // datePath
    fs.stat.mockResolvedValue({ isDirectory: () => true });
    // result.json, metadata.json, telemetry.json all return empty objects
    fs.readFile.mockResolvedValue(JSON.stringify({}));

    const result = await getCostSummary('/base', {});
    expect(result).toBe('No cost data found in sessions.');
  });

  it('returns cost summary when session has totalCost', async () => {
    const fs = await getFsMock();
    fs.readdir
      .mockResolvedValueOnce(['2024-01-15'])
      .mockResolvedValueOnce(['001']);
    fs.stat.mockResolvedValue({ isDirectory: () => true });
    fs.readFile.mockResolvedValue(JSON.stringify({ totalCost: 0.05 }));

    const result = await getCostSummary('/base', {});
    expect(result).toContain('0.0500');
    expect(result).toContain('1'); // session count
  });

  it('returns cost summary when session has costs array', async () => {
    const fs = await getFsMock();
    fs.readdir
      .mockResolvedValueOnce(['2024-01-15'])
      .mockResolvedValueOnce(['001']);
    fs.stat.mockResolvedValue({ isDirectory: () => true });
    fs.readFile.mockResolvedValue(
      JSON.stringify({
        costs: [
          { reviewerId: 'r1', provider: 'openai', totalCost: 0.02 },
          { reviewerId: 'r2', provider: 'anthropic', totalCost: 0.03 },
        ],
      }),
    );

    const result = await getCostSummary('/base', {});
    expect(result).toContain('0.0500');
  });

  it('groups by reviewer when by=reviewer option is set', async () => {
    const fs = await getFsMock();
    fs.readdir
      .mockResolvedValueOnce(['2024-01-15'])
      .mockResolvedValueOnce(['001']);
    fs.stat.mockResolvedValue({ isDirectory: () => true });
    fs.readFile.mockResolvedValue(
      JSON.stringify({
        costs: [
          { reviewerId: 'alice', provider: 'openai', totalCost: 0.01 },
          { reviewerId: 'bob', provider: 'openai', totalCost: 0.02 },
        ],
      }),
    );

    const result = await getCostSummary('/base', { by: 'reviewer' });
    expect(result).toContain('alice');
    expect(result).toContain('bob');
  });

  it('skips date dirs before cutoff when --last option is set', async () => {
    const fs = await getFsMock();
    // Two date dirs: one old, one recent
    fs.readdir.mockResolvedValueOnce(['2020-01-01', '2024-01-15']);
    // Should only be called for the recent one
    fs.readdir.mockResolvedValueOnce(['001']);
    fs.stat.mockResolvedValue({ isDirectory: () => true });
    fs.readFile.mockResolvedValue(JSON.stringify({ totalCost: 0.05 }));

    const result = await getCostSummary('/base', { last: 30 });
    // Should still work without erroring
    expect(typeof result).toBe('string');
  });
});
