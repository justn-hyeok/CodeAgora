import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Config, AgentConfig } from '../../../types/config.js';

interface Props {
  config: Config;
  isActive: boolean;
  onConfigChange: (newConfig: Config) => void;
}

export function SupportersTab({ config, isActive, onConfigChange }: Props): React.JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [message, setMessage] = useState('');

  const pool = config.supporters.pool;
  const da = config.supporters.devilsAdvocate;

  // Items: pool entries + da entry
  const totalItems = pool.length + 1; // +1 for DA

  function showMessage(msg: string): void {
    setMessage(msg);
    setTimeout(() => setMessage(''), 1500);
  }

  function togglePoolItem(index: number): void {
    const item = pool[index];
    if (!item) return;
    const updated = pool.map((s, i) =>
      i === index ? { ...s, enabled: !s.enabled } : s
    );
    onConfigChange({ ...config, supporters: { ...config.supporters, pool: updated } });
    showMessage('Saved ✓');
  }

  function toggleDA(): void {
    onConfigChange({
      ...config,
      supporters: {
        ...config.supporters,
        devilsAdvocate: { ...da, enabled: !da.enabled },
      },
    });
    showMessage('Saved ✓');
  }

  useInput((input, key) => {
    if (!isActive) return;

    if (key.upArrow || input === 'k') {
      setSelectedIndex(i => Math.max(0, i - 1));
    } else if (key.downArrow || input === 'j') {
      setSelectedIndex(i => Math.min(totalItems - 1, i + 1));
    } else if (input === ' ') {
      if (selectedIndex < pool.length) {
        togglePoolItem(selectedIndex);
      } else {
        toggleDA();
      }
    }
  });

  const daIndex = pool.length;

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text dimColor>Space to toggle  j/k navigate</Text>
      <Text bold>Pool ({pool.length}):</Text>
      {pool.map((s: AgentConfig, i: number) => {
        const selected = i === selectedIndex;
        return (
          <Box key={s.id}>
            <Text backgroundColor={selected ? 'blue' : undefined}>
              {selected ? '> ' : '  '}{s.id}{'  '}{s.provider ?? ''}/{s.model}{'  '}
              {s.enabled ? <Text color="green">ON</Text> : <Text color="red">OFF</Text>}
            </Text>
          </Box>
        );
      })}
      <Text bold>Devil&apos;s Advocate:</Text>
      <Box>
        <Text backgroundColor={selectedIndex === daIndex ? 'blue' : undefined}>
          {selectedIndex === daIndex ? '> ' : '  '}{da.id}{'  '}{da.provider ?? ''}/{da.model}{'  '}
          {da.enabled ? <Text color="green">ON</Text> : <Text color="red">OFF</Text>}
        </Text>
      </Box>
      <Text dimColor>pickCount: {config.supporters.pickCount}  pickStrategy: {config.supporters.pickStrategy}</Text>
      {message ? <Text color="green">{message}</Text> : null}
    </Box>
  );
}
