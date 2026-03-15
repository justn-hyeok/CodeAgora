import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Config } from '../../../types/config.js';

interface PresetDef {
  name: string;
  description: string;
  build: () => Partial<Config>;
}

const PRESETS: PresetDef[] = [
  {
    name: 'Quick Setup',
    description: '3 Groq reviewers + 1 supporter',
    build: () => ({
      reviewers: [
        { id: 'r1', model: 'llama-3.3-70b-versatile', backend: 'api' as const, provider: 'groq', enabled: true, timeout: 120 },
        { id: 'r2', model: 'llama-3.3-70b-versatile', backend: 'api' as const, provider: 'groq', enabled: true, timeout: 120 },
        { id: 'r3', model: 'llama-3.3-70b-versatile', backend: 'api' as const, provider: 'groq', enabled: true, timeout: 120 },
      ],
      supporters: {
        pool: [
          { id: 's1', model: 'llama-3.3-70b-versatile', backend: 'api' as const, provider: 'groq', enabled: true, timeout: 120 },
        ],
        pickCount: 1,
        pickStrategy: 'random' as const,
        devilsAdvocate: {
          id: 'da',
          model: 'llama-3.3-70b-versatile',
          backend: 'api' as const,
          provider: 'groq',
          enabled: true,
          timeout: 120,
        },
        personaPool: ['.ca/personas/strict.md'],
        personaAssignment: 'random' as const,
      },
    }),
  },
  {
    name: 'Diversity',
    description: 'Groq + Google + Mistral mix',
    build: () => ({
      reviewers: [
        { id: 'r1', model: 'llama-3.3-70b-versatile', backend: 'api' as const, provider: 'groq', enabled: true, timeout: 120 },
        { id: 'r2', model: 'gemini-2.0-flash', backend: 'api' as const, provider: 'google', enabled: true, timeout: 120 },
        { id: 'r3', model: 'mistral-large-latest', backend: 'api' as const, provider: 'mistral', enabled: true, timeout: 120 },
      ],
      supporters: {
        pool: [
          { id: 's1', model: 'llama-3.3-70b-versatile', backend: 'api' as const, provider: 'groq', enabled: true, timeout: 120 },
        ],
        pickCount: 1,
        pickStrategy: 'random' as const,
        devilsAdvocate: {
          id: 'da',
          model: 'mistral-large-latest',
          backend: 'api' as const,
          provider: 'mistral',
          enabled: true,
          timeout: 120,
        },
        personaPool: ['.ca/personas/strict.md'],
        personaAssignment: 'random' as const,
      },
    }),
  },
  {
    name: 'Minimal',
    description: '1 reviewer + 1 supporter',
    build: () => ({
      reviewers: [
        { id: 'r1', model: 'llama-3.3-70b-versatile', backend: 'api' as const, provider: 'groq', enabled: true, timeout: 120 },
      ],
      supporters: {
        pool: [
          { id: 's1', model: 'llama-3.3-70b-versatile', backend: 'api' as const, provider: 'groq', enabled: true, timeout: 120 },
        ],
        pickCount: 1,
        pickStrategy: 'random' as const,
        devilsAdvocate: {
          id: 'da',
          model: 'llama-3.3-70b-versatile',
          backend: 'api' as const,
          provider: 'groq',
          enabled: true,
          timeout: 120,
        },
        personaPool: ['.ca/personas/strict.md'],
        personaAssignment: 'random' as const,
      },
    }),
  },
];

interface Props {
  config: Config;
  isActive: boolean;
  onConfigChange: (newConfig: Config) => void;
}

export function PresetsTab({ config, isActive, onConfigChange }: Props): React.JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  function showMessage(msg: string): void {
    setMessage(msg);
    setTimeout(() => setMessage(''), 1500);
  }

  function applyPreset(index: number): void {
    const preset = PRESETS[index];
    if (!preset) return;
    const partial = preset.build();
    onConfigChange({ ...config, ...partial } as Config);
    setConfirmIndex(null);
    showMessage(`Applied: ${preset.name} ✓`);
  }

  useInput((input, key) => {
    if (!isActive) return;

    if (confirmIndex !== null) {
      if (input === 'y' || input === 'Y') {
        applyPreset(confirmIndex);
      } else if (input === 'n' || input === 'N' || key.escape) {
        setConfirmIndex(null);
      }
      return;
    }

    if (key.upArrow || input === 'k') {
      setSelectedIndex(i => Math.max(0, i - 1));
    } else if (key.downArrow || input === 'j') {
      setSelectedIndex(i => Math.min(PRESETS.length - 1, i + 1));
    } else if (key.return || input === ' ') {
      setConfirmIndex(selectedIndex);
    }
  });

  if (confirmIndex !== null) {
    const preset = PRESETS[confirmIndex]!;
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold color="yellow">Apply preset &quot;{preset.name}&quot;?</Text>
        <Text>기존 설정이 대체됩니다.</Text>
        <Text>Press <Text bold>y</Text> to confirm, <Text bold>n</Text> to cancel</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text dimColor>j/k navigate  Enter/Space to apply</Text>
      {PRESETS.map((preset, i) => {
        const selected = i === selectedIndex;
        return (
          <Box key={preset.name} flexDirection="column" marginBottom={0}>
            <Text backgroundColor={selected ? 'blue' : undefined}>
              {selected ? '> ' : '  '}<Text bold>{preset.name}</Text>
            </Text>
            <Text>    <Text dimColor>{preset.description}</Text></Text>
          </Box>
        );
      })}
      {message ? <Text color="green">{message}</Text> : null}
    </Box>
  );
}
