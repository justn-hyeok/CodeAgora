/**
 * Tests for mode-presets.ts
 */

import { describe, it, expect } from 'vitest';
import { getModePreset } from '../config/mode-presets.js';

describe('getModePreset', () => {
  describe('strict mode', () => {
    it('returns strict preset for strict mode', () => {
      const preset = getModePreset('strict');
      expect(preset).toBeDefined();
    });

    it('strict preset has SUGGESTION threshold of 2', () => {
      const preset = getModePreset('strict');
      expect(preset.registrationThreshold.SUGGESTION).toBe(2);
    });

    it('strict preset has HARSHLY_CRITICAL threshold of 1', () => {
      const preset = getModePreset('strict');
      expect(preset.registrationThreshold.HARSHLY_CRITICAL).toBe(1);
    });

    it('strict preset has CRITICAL threshold of 1', () => {
      const preset = getModePreset('strict');
      expect(preset.registrationThreshold.CRITICAL).toBe(1);
    });

    it('strict preset has WARNING threshold of 1', () => {
      const preset = getModePreset('strict');
      expect(preset.registrationThreshold.WARNING).toBe(1);
    });

    it('strict preset has maxRounds of 5', () => {
      const preset = getModePreset('strict');
      expect(preset.maxRounds).toBe(5);
    });

    it('strict preset persona pool includes strict.md', () => {
      const preset = getModePreset('strict');
      expect(preset.personaPool.some((p) => p.includes('strict.md'))).toBe(true);
    });

    it('strict preset persona pool includes security-focused.md', () => {
      const preset = getModePreset('strict');
      expect(preset.personaPool.some((p) => p.includes('security-focused.md'))).toBe(true);
    });
  });

  describe('pragmatic mode', () => {
    it('returns pragmatic preset for pragmatic mode', () => {
      const preset = getModePreset('pragmatic');
      expect(preset).toBeDefined();
    });

    it('pragmatic preset has SUGGESTION threshold of null', () => {
      const preset = getModePreset('pragmatic');
      expect(preset.registrationThreshold.SUGGESTION).toBeNull();
    });

    it('pragmatic preset has WARNING threshold of 2', () => {
      const preset = getModePreset('pragmatic');
      expect(preset.registrationThreshold.WARNING).toBe(2);
    });

    it('pragmatic preset has HARSHLY_CRITICAL threshold of 1', () => {
      const preset = getModePreset('pragmatic');
      expect(preset.registrationThreshold.HARSHLY_CRITICAL).toBe(1);
    });

    it('pragmatic preset has maxRounds of 4', () => {
      const preset = getModePreset('pragmatic');
      expect(preset.maxRounds).toBe(4);
    });

    it('pragmatic preset persona pool includes pragmatic.md', () => {
      const preset = getModePreset('pragmatic');
      expect(preset.personaPool.some((p) => p.includes('pragmatic.md'))).toBe(true);
    });
  });

  describe('mode differences', () => {
    it('strict and pragmatic presets are different objects', () => {
      const strict = getModePreset('strict');
      const pragmatic = getModePreset('pragmatic');
      expect(strict).not.toBe(pragmatic);
    });

    it('strict has more maxRounds than pragmatic', () => {
      const strict = getModePreset('strict');
      const pragmatic = getModePreset('pragmatic');
      expect(strict.maxRounds).toBeGreaterThan(pragmatic.maxRounds);
    });

    it('strict WARNING threshold is lower than pragmatic (more strict)', () => {
      const strict = getModePreset('strict');
      const pragmatic = getModePreset('pragmatic');
      expect(strict.registrationThreshold.WARNING).toBeLessThan(
        pragmatic.registrationThreshold.WARNING,
      );
    });
  });
});
