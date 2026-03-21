/**
 * L0 BanditStore — save failure path and core operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { BanditStore } from '../l0/bandit-store.js';

describe('BanditStore', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'bandit-test-'));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('starts with empty arms and history', () => {
    const store = new BanditStore(path.join(tmpDir, 'quality.json'));
    expect(store.getAllArms().size).toBe(0);
    expect(store.getHistory()).toHaveLength(0);
  });

  it('updateArm() with reward=1 increments alpha', () => {
    const store = new BanditStore(path.join(tmpDir, 'quality.json'));
    store.updateArm('openrouter/claude', 1);
    const arm = store.getArm('openrouter/claude');
    expect(arm).toBeDefined();
    expect(arm!.alpha).toBe(2); // default 1 + 1
    expect(arm!.beta).toBe(1);  // unchanged
    expect(arm!.reviewCount).toBe(1);
  });

  it('updateArm() with reward=0 increments beta', () => {
    const store = new BanditStore(path.join(tmpDir, 'quality.json'));
    store.updateArm('openrouter/claude', 0);
    const arm = store.getArm('openrouter/claude');
    expect(arm!.alpha).toBe(1);
    expect(arm!.beta).toBe(2);
  });

  it('save() then load() round-trips data correctly', async () => {
    const filePath = path.join(tmpDir, 'quality.json');
    const store = new BanditStore(filePath);
    store.updateArm('groq/llama', 1);
    store.updateArm('groq/llama', 1);
    await store.save();

    const store2 = new BanditStore(filePath);
    await store2.load();
    const arm = store2.getArm('groq/llama');
    expect(arm).toBeDefined();
    expect(arm!.alpha).toBe(3); // default 1 + 2 rewards
    expect(arm!.reviewCount).toBe(2);
  });

  it('load() on a non-existent file uses defaults silently', async () => {
    const store = new BanditStore(path.join(tmpDir, 'missing.json'));
    await expect(store.load()).resolves.toBeUndefined();
    expect(store.getAllArms().size).toBe(0);
  });

  it('save() rejects when the file path is invalid (write to a directory path)', async () => {
    // Create a directory at the path where the JSON file should go —
    // writeFile will then fail with EISDIR or similar
    const badPath = path.join(tmpDir, 'quality.json');
    await mkdir(badPath, { recursive: true }); // make it a directory, not a file

    const store = new BanditStore(badPath);
    await expect(store.save()).rejects.toThrow();
  });

  it('warmStart() creates new arm with 50% decayed priors', () => {
    const store = new BanditStore(path.join(tmpDir, 'quality.json'));
    // Manually set arm state
    store.updateArm('old/model', 1);
    store.updateArm('old/model', 1);
    store.updateArm('old/model', 1); // alpha=4, beta=1

    store.warmStart('old/model', 'new/model');
    const newArm = store.getArm('new/model');
    expect(newArm).toBeDefined();
    // alpha = round(4 * 0.5) + 1 = 3
    expect(newArm!.alpha).toBe(3);
    expect(newArm!.reviewCount).toBe(0);
  });

  it('addHistory() trims to maxHistory entries', () => {
    const store = new BanditStore(path.join(tmpDir, 'quality.json'));
    const base = {
      diffId: 'diff-1',
      provider: 'groq',
      timestamp: Date.now(),
      issuesRaised: 1,
      specificityScore: 0.8,
      peerValidationRate: null,
      headAcceptanceRate: null,
      compositeQ: null,
      rewardSignal: null as null,
    };

    for (let i = 0; i < 5; i++) {
      store.addHistory({ ...base, reviewId: `r${i}`, modelId: 'llama' }, 3);
    }
    expect(store.getHistory()).toHaveLength(3);
  });
});
