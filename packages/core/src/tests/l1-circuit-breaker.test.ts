/**
 * L1 Circuit Breaker — state transitions including half-open
 */

import { describe, it, expect } from 'vitest';
import { CircuitBreaker, CircuitOpenError } from '../l1/circuit-breaker.js';

describe('CircuitBreaker', () => {
  const makeBreaker = (overrides?: { failureThreshold?: number; cooldownMs?: number }) =>
    new CircuitBreaker({
      failureThreshold: 3,
      cooldownMs: 1000,
      maxCooldownMs: 10_000,
      ...overrides,
    });

  it('starts in closed state', () => {
    const cb = makeBreaker();
    expect(cb.getState('openrouter', 'claude')).toBe('closed');
    expect(cb.isOpen('openrouter', 'claude')).toBe(false);
  });

  it('stays closed below the failure threshold', () => {
    const cb = makeBreaker({ failureThreshold: 3 });
    cb.recordFailure('openrouter', 'claude');
    cb.recordFailure('openrouter', 'claude');
    expect(cb.getState('openrouter', 'claude')).toBe('closed');
  });

  it('opens after reaching the failure threshold', () => {
    const cb = makeBreaker({ failureThreshold: 3 });
    cb.recordFailure('openrouter', 'claude');
    cb.recordFailure('openrouter', 'claude');
    cb.recordFailure('openrouter', 'claude');
    expect(cb.getState('openrouter', 'claude')).toBe('open');
    expect(cb.isOpen('openrouter', 'claude')).toBe(true);
  });

  it('transitions open → half-open after cooldown elapses', () => {
    let now = 0;
    const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 1000, nowFn: () => now });

    now = 1000;
    cb.recordFailure('p', 'm'); // opens; lastFailure = 1000

    now = 2001; // 1001 ms later → cooldown elapsed
    expect(cb.getState('p', 'm')).toBe('half-open');
  });

  it('half-open → closed on success', () => {
    let now = 0;
    const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 1000, nowFn: () => now });

    now = 0;
    cb.recordFailure('p', 'm');

    now = 2000; // cooldown elapsed → half-open
    expect(cb.getState('p', 'm')).toBe('half-open');

    cb.recordSuccess('p', 'm');
    expect(cb.getState('p', 'm')).toBe('closed');
  });

  it('half-open → open on failure (doubled cooldown)', () => {
    let now = 0;
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 1000,
      maxCooldownMs: 10_000,
      nowFn: () => now,
    });

    now = 0;
    cb.recordFailure('p', 'm'); // opens; cooldownMs = 1000

    now = 2000; // half-open
    expect(cb.getState('p', 'm')).toBe('half-open');

    cb.recordFailure('p', 'm'); // reopens; cooldownMs doubles to 2000
    expect(cb.getState('p', 'm')).toBe('open');

    const full = cb.getFullState('p', 'm');
    expect(full.cooldownMs).toBe(2000);
  });

  it('half-open cooldown is capped at maxCooldownMs', () => {
    let now = 0;
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 6000,
      maxCooldownMs: 10_000,
      nowFn: () => now,
    });

    now = 0;
    cb.recordFailure('p', 'm'); // cooldownMs = 6000

    now = 7000; // half-open
    cb.recordFailure('p', 'm'); // would be 12000 but capped at 10000

    const full = cb.getFullState('p', 'm');
    expect(full.cooldownMs).toBe(10_000);
  });

  it('recordSuccess() in closed state resets fail count', () => {
    const cb = makeBreaker({ failureThreshold: 3 });
    cb.recordFailure('p', 'm');
    cb.recordFailure('p', 'm');
    cb.recordSuccess('p', 'm');
    // After reset, two more failures should not open the circuit
    cb.recordFailure('p', 'm');
    cb.recordFailure('p', 'm');
    expect(cb.getState('p', 'm')).toBe('closed');
  });

  it('clear() resets all circuits', () => {
    const cb = makeBreaker({ failureThreshold: 1 });
    cb.recordFailure('p', 'm');
    expect(cb.getState('p', 'm')).toBe('open');
    cb.clear();
    expect(cb.getState('p', 'm')).toBe('closed');
  });

  it('tracks separate circuits per provider/model pair', () => {
    const cb = makeBreaker({ failureThreshold: 1 });
    cb.recordFailure('provA', 'model1');
    expect(cb.getState('provA', 'model1')).toBe('open');
    expect(cb.getState('provB', 'model2')).toBe('closed');
  });

  it('CircuitOpenError carries provider and model', () => {
    const err = new CircuitOpenError('groq', 'llama3');
    expect(err.provider).toBe('groq');
    expect(err.model).toBe('llama3');
    expect(err.name).toBe('CircuitOpenError');
  });
});
