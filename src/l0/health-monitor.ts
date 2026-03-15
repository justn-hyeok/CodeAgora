/**
 * Health Monitor
 * Per-model circuit breaker with exponential cooldown + daily RPD budget tracking.
 */

import type { CircuitBreakerState, PingResult } from '../types/l0.js';

// ============================================================================
// Circuit Breaker Config Defaults
// ============================================================================

interface CircuitBreakerConfig {
  failureThreshold: number;
  cooldownMs: number;
  maxCooldownMs: number;
}

const DEFAULT_CB_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  cooldownMs: 60_000,
  maxCooldownMs: 300_000,
};

// ============================================================================
// Health Monitor
// ============================================================================

export class HealthMonitor {
  private circuits = new Map<string, CircuitBreakerState>();
  private dailyCounts = new Map<string, number>();
  private dailyBudgets = new Map<string, number>();
  private cbConfig: CircuitBreakerConfig;
  private nowFn: () => number;

  constructor(options?: {
    circuitBreaker?: Partial<CircuitBreakerConfig>;
    dailyBudget?: Record<string, number>;
    nowFn?: () => number;
  }) {
    this.cbConfig = { ...DEFAULT_CB_CONFIG, ...options?.circuitBreaker };
    this.nowFn = options?.nowFn ?? (() => Date.now());

    if (options?.dailyBudget) {
      for (const [provider, limit] of Object.entries(options.dailyBudget)) {
        this.dailyBudgets.set(provider, limit);
      }
    }
  }

  // ==========================================================================
  // Circuit Breaker
  // ==========================================================================

  private getKey(provider: string, modelId: string): string {
    return `${provider}/${modelId}`;
  }

  private getCircuit(key: string): CircuitBreakerState {
    let circuit = this.circuits.get(key);
    if (!circuit) {
      circuit = {
        state: 'closed',
        failCount: 0,
        lastFailure: null,
        cooldownMs: this.cbConfig.cooldownMs,
        successCount: 0,
      };
      this.circuits.set(key, circuit);
    }
    return circuit;
  }

  getCircuitState(provider: string, modelId: string): CircuitBreakerState {
    return this.getCircuit(this.getKey(provider, modelId));
  }

  /**
   * Check if a model is available (circuit not open + within RPD budget).
   */
  isAvailable(provider: string, modelId: string): boolean {
    const key = this.getKey(provider, modelId);
    const circuit = this.getCircuit(key);

    // Check circuit breaker
    if (circuit.state === 'open') {
      const now = this.nowFn();
      if (now - (circuit.lastFailure ?? 0) >= circuit.cooldownMs) {
        // Transition to half-open
        circuit.state = 'half-open';
        circuit.successCount = 0;
      } else {
        return false;
      }
    }

    // Check RPD budget
    if (!this.isWithinBudget(provider)) {
      return false;
    }

    return true;
  }

  recordSuccess(provider: string, modelId: string): void {
    const key = this.getKey(provider, modelId);
    const circuit = this.getCircuit(key);

    if (circuit.state === 'half-open') {
      // Half-open success → close circuit, reset cooldown
      circuit.state = 'closed';
      circuit.failCount = 0;
      circuit.cooldownMs = this.cbConfig.cooldownMs;
      circuit.successCount = 0;
    } else {
      circuit.failCount = 0;
    }
  }

  recordFailure(provider: string, modelId: string): void {
    const key = this.getKey(provider, modelId);
    const circuit = this.getCircuit(key);
    const now = this.nowFn();

    circuit.failCount++;
    circuit.lastFailure = now;

    if (circuit.state === 'half-open') {
      // Half-open failure → back to open, double cooldown
      circuit.state = 'open';
      circuit.cooldownMs = Math.min(
        circuit.cooldownMs * 2,
        this.cbConfig.maxCooldownMs
      );
    } else if (circuit.failCount >= this.cbConfig.failureThreshold) {
      circuit.state = 'open';
    }
  }

  // ==========================================================================
  // Ping
  // ==========================================================================

  /**
   * Ping a model endpoint via AI SDK generateText.
   * Accepts an executor function to decouple from provider-registry.
   */
  async ping(
    modelId: string,
    provider: string,
    executor: (modelId: string, provider: string) => Promise<string>
  ): Promise<PingResult> {
    const start = this.nowFn();

    try {
      await executor(modelId, provider);
      const latencyMs = this.nowFn() - start;

      this.recordSuccess(provider, modelId);

      return {
        modelId,
        provider,
        status: 'up',
        latencyMs,
        timestamp: start,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isRateLimited = /rate.?limit|429|too many/i.test(message);

      this.recordFailure(provider, modelId);

      return {
        modelId,
        provider,
        status: isRateLimited ? 'rate-limited' : 'down',
        latencyMs: null,
        timestamp: start,
      };
    }
  }

  /**
   * Ping multiple models concurrently.
   */
  async pingAll(
    models: Array<{ modelId: string; provider: string }>,
    executor: (modelId: string, provider: string) => Promise<string>,
    concurrency: number = 20
  ): Promise<PingResult[]> {
    const results: PingResult[] = [];
    const queue = [...models];

    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length > 0) {
        const item = queue.shift()!;
        const result = await this.ping(item.modelId, item.provider, executor);
        results.push(result);
      }
    });

    await Promise.all(workers);
    return results;
  }

  // ==========================================================================
  // RPD Budget
  // ==========================================================================

  recordRequest(provider: string): void {
    const current = this.dailyCounts.get(provider) ?? 0;
    this.dailyCounts.set(provider, current + 1);
  }

  getRemainingBudget(provider: string): number | null {
    const budget = this.dailyBudgets.get(provider);
    if (budget === undefined) return null;

    const used = this.dailyCounts.get(provider) ?? 0;
    return Math.max(0, budget - used);
  }

  isWithinBudget(provider: string): boolean {
    const budget = this.dailyBudgets.get(provider);
    if (budget === undefined) return true; // No budget set = unlimited

    const used = this.dailyCounts.get(provider) ?? 0;
    return used < budget;
  }

  /**
   * Check if provider is at 80%+ budget usage (warning threshold).
   */
  isNearBudgetLimit(provider: string): boolean {
    const budget = this.dailyBudgets.get(provider);
    if (budget === undefined) return false;

    const used = this.dailyCounts.get(provider) ?? 0;
    return used >= budget * 0.8;
  }

  resetDailyBudgets(): void {
    this.dailyCounts.clear();
  }
}
