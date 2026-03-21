/**
 * Tests for l2/event-emitter.ts
 */

import { describe, it, expect, vi } from 'vitest';
import { DiscussionEmitter } from '../l2/event-emitter.js';
import type {
  DiscussionStartEvent,
  RoundStartEvent,
  SupporterResponseEvent,
  ConsensusCheckEvent,
  ForcedDecisionEvent,
  DiscussionEndEvent,
} from '../l2/event-emitter.js';

describe('DiscussionEmitter', () => {
  describe('construction', () => {
    it('creates an instance without throwing', () => {
      const emitter = new DiscussionEmitter();
      expect(emitter).toBeDefined();
      emitter.dispose();
    });

    it('has maxListeners set to 50', () => {
      const emitter = new DiscussionEmitter();
      expect(emitter.getMaxListeners()).toBe(50);
      emitter.dispose();
    });
  });

  describe('emitEvent', () => {
    it('emits discussion-start event to typed listener', () => {
      const emitter = new DiscussionEmitter();
      const handler = vi.fn();

      const event: DiscussionStartEvent = {
        type: 'discussion-start',
        discussionId: 'd001',
        issueTitle: 'SQL injection',
        filePath: 'src/db.ts',
        severity: 'CRITICAL',
      };

      emitter.on('discussion-start', handler);
      emitter.emitEvent(event);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(event);
      emitter.dispose();
    });

    it('emits round-start event', () => {
      const emitter = new DiscussionEmitter();
      const handler = vi.fn();

      const event: RoundStartEvent = {
        type: 'round-start',
        discussionId: 'd001',
        roundNum: 1,
      };

      emitter.on('round-start', handler);
      emitter.emitEvent(event);

      expect(handler).toHaveBeenCalledWith(event);
      emitter.dispose();
    });

    it('emits supporter-response event', () => {
      const emitter = new DiscussionEmitter();
      const handler = vi.fn();

      const event: SupporterResponseEvent = {
        type: 'supporter-response',
        discussionId: 'd001',
        roundNum: 1,
        supporterId: 's1',
        stance: 'agree',
        response: 'I agree with the assessment',
      };

      emitter.on('supporter-response', handler);
      emitter.emitEvent(event);

      expect(handler).toHaveBeenCalledWith(event);
      emitter.dispose();
    });

    it('also fires wildcard "*" listener for every event', () => {
      const emitter = new DiscussionEmitter();
      const wildcardHandler = vi.fn();

      const event: RoundStartEvent = {
        type: 'round-start',
        discussionId: 'd001',
        roundNum: 2,
      };

      emitter.on('*', wildcardHandler);
      emitter.emitEvent(event);

      expect(wildcardHandler).toHaveBeenCalledOnce();
      expect(wildcardHandler).toHaveBeenCalledWith(event);
      emitter.dispose();
    });

    it('wildcard listener receives all event types', () => {
      const emitter = new DiscussionEmitter();
      const wildcardHandler = vi.fn();
      emitter.on('*', wildcardHandler);

      const events = [
        { type: 'discussion-start', discussionId: 'd1', issueTitle: 't', filePath: 'f', severity: 'WARNING' } as DiscussionStartEvent,
        { type: 'round-start', discussionId: 'd1', roundNum: 1 } as RoundStartEvent,
        { type: 'discussion-end', discussionId: 'd1', finalSeverity: 'WARNING', consensusReached: true, rounds: 1 } as DiscussionEndEvent,
      ];

      for (const e of events) emitter.emitEvent(e);

      expect(wildcardHandler).toHaveBeenCalledTimes(3);
      emitter.dispose();
    });

    it('emits consensus-check event with reached=true', () => {
      const emitter = new DiscussionEmitter();
      const handler = vi.fn();

      const event: ConsensusCheckEvent = {
        type: 'consensus-check',
        discussionId: 'd001',
        roundNum: 2,
        reached: true,
        severity: 'WARNING',
      };

      emitter.on('consensus-check', handler);
      emitter.emitEvent(event);

      expect(handler).toHaveBeenCalledWith(event);
      emitter.dispose();
    });

    it('emits forced-decision event', () => {
      const emitter = new DiscussionEmitter();
      const handler = vi.fn();

      const event: ForcedDecisionEvent = {
        type: 'forced-decision',
        discussionId: 'd001',
        severity: 'CRITICAL',
        reasoning: 'Max rounds reached',
      };

      emitter.on('forced-decision', handler);
      emitter.emitEvent(event);

      expect(handler).toHaveBeenCalledWith(event);
      emitter.dispose();
    });
  });

  describe('dispose', () => {
    it('removes all listeners after dispose', () => {
      const emitter = new DiscussionEmitter();
      const handler = vi.fn();

      emitter.on('round-start', handler);
      emitter.dispose();

      const event: RoundStartEvent = {
        type: 'round-start',
        discussionId: 'd001',
        roundNum: 1,
      };
      emitter.emitEvent(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('reports zero listeners after dispose', () => {
      const emitter = new DiscussionEmitter();
      emitter.on('*', vi.fn());
      emitter.on('round-start', vi.fn());
      emitter.dispose();

      expect(emitter.listenerCount('*')).toBe(0);
      expect(emitter.listenerCount('round-start')).toBe(0);
    });
  });
});
